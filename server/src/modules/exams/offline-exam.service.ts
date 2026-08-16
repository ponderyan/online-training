import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';
import { getPassingScore } from '../../common/grading.utils.js';

/**
 * 线下笔试考试服务
 * 状态机：DRAFT → PUBLISHED → AWAITING_GRADING → GRADING_IN_PROGRESS → SCORE_CONFIRMED → SCORE_PUBLISHED → COMPLETED
 */
@Injectable()
export class OfflineExamService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════
  // 状态机流转
  // ═══════════════════════════════════════════

  /** 发布考试 DRAFT → PUBLISHED */
  async publish(examId: number) {
    const exam = await this.getOfflineExam(examId);
    if (exam.status !== 'DRAFT') throw new BadRequestException('只能发布草稿状态的考试');
    return this.prisma.exam.update({ where: { id: examId }, data: { status: 'PUBLISHED' } });
  }

  /** 考试结束，进入待阅卷 PUBLISHED → AWAITING_GRADING */
  async startGrading(examId: number) {
    const exam = await this.getOfflineExam(examId);
    if (exam.status !== 'PUBLISHED') throw new BadRequestException('只有已发布的考试可以进入阅卷阶段');

    // 校验：必须有考生
    const sessionCount = await this.prisma.examSession.count({ where: { examId } });
    if (sessionCount === 0) throw new BadRequestException('该考试尚未分配考生，不能进入阅卷阶段');

    // 线下统一笔试：考试已进行，所有 ASSIGNED 的 session 视为已交卷
    await this.prisma.examSession.updateMany({
      where: { examId, status: 'ASSIGNED' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    return this.prisma.exam.update({ where: { id: examId }, data: { status: 'AWAITING_GRADING' } });
  }

  /** 开始录入成绩 AWAITING_GRADING → GRADING_IN_PROGRESS */
  async startScoreEntry(examId: number) {
    const exam = await this.getOfflineExam(examId);
    if (exam.status !== 'AWAITING_GRADING') throw new BadRequestException('只有待阅卷状态可以开始录入');
    return this.prisma.exam.update({ where: { id: examId }, data: { status: 'GRADING_IN_PROGRESS' } });
  }

  /** 确认成绩（需审批）GRADING_IN_PROGRESS → SCORE_CONFIRMED */
  async confirmScores(examId: number, confirmedBy: number, approvalNote?: string) {
    const exam = await this.getOfflineExam(examId);
    if (exam.status !== 'GRADING_IN_PROGRESS') throw new BadRequestException('只有录入中状态可以确认成绩');

    // 检查是否所有非缺考学员都已录入成绩
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, absent: false },
      select: { id: true },
    });
    if (sessions.length === 0) throw new BadRequestException('没有需要确认成绩的学员');
    const entries = await this.prisma.offlineScoreEntry.findMany({
      where: { examId },
      select: { sessionId: true },
    });
    const enteredSessionIds = new Set(entries.map(e => e.sessionId));
    const missing = sessions.filter(s => !enteredSessionIds.has(s.id));
    if (missing.length > 0) {
      throw new BadRequestException(`还有 ${missing.length} 名学员未录入成绩，不能确认`);
    }

    return this.prisma.exam.update({
      where: { id: examId },
      data: { status: 'SCORE_CONFIRMED' },
    });
  }

  /** 发布成绩 SCORE_CONFIRMED → SCORE_PUBLISHED（触发证书） */
  async publishScores(examId: number) {
    const exam = await this.getOfflineExam(examId);
    if (exam.status !== 'SCORE_CONFIRMED') throw new BadRequestException('只有已确认的成绩可以发布');

    // 更新所有 session 的 scoringStatus
    await this.prisma.examSession.updateMany({
      where: { examId, absent: false },
      data: { scoringStatus: 'PUBLISHED', scoringPublishedAt: new Date() },
    });

    // 自动为通过的学员创建证书申请
    const passedSessions = await this.prisma.examSession.findMany({
      where: { examId, isPassed: true, absent: false },
      select: { id: true, studentId: true },
    });
    // ★ 2026-08-16 机构归属：从 exam→program 解析，供审批列表 org 隔离
    const certOrgId = exam?.orgId ?? (exam as any)?.program?.orgId ?? null;
    for (const s of passedSessions) {
      const existing = await this.prisma.certificateApplication.findFirst({
        where: { sessionId: s.id, status: { not: 'REJECTED' } },
      });
      if (existing) continue;
      await this.prisma.certificateApplication.create({
        data: { sessionId: s.id, studentId: s.studentId, status: 'PENDING', orgId: certOrgId },
      });
    }

    return this.prisma.exam.update({ where: { id: examId }, data: { status: 'SCORE_PUBLISHED' } });
  }

  // ═══════════════════════════════════════════
  // 成绩录入
  // ═══════════════════════════════════════════

  /** 逐人录入成绩 */
  async enterScore(examId: number, sessionId: number, data: {
    scoreByType: Record<string, number>;
    graderName?: string;
    graderId?: number | null;
    gradedAt?: string;
    enteredBy: number;
  }) {
    const exam = await this.getOfflineExam(examId);
    if (!['AWAITING_GRADING', 'GRADING_IN_PROGRESS'].includes(exam.status)) {
      throw new BadRequestException('当前状态不允许录入成绩');
    }

    // 自动流转到录入中
    if (exam.status === 'AWAITING_GRADING') {
      await this.prisma.exam.update({ where: { id: examId }, data: { status: 'GRADING_IN_PROGRESS' } });
    }

    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, examId },
      include: { exam: { include: { paper: true } } },
    });
    if (!session) throw new NotFoundException('考试会话不存在');
    if (session.absent) throw new BadRequestException('该学员已标记缺考，不能录入成绩');

    // 计算总分
    const totalScore = Object.values(data.scoreByType).reduce((sum, v) => sum + (v || 0), 0);

    // 验证分数不超过试卷满分
    const paperTotal = session.exam.paper?.totalScore || 100;
    if (totalScore > paperTotal) {
      throw new BadRequestException(`总分 ${totalScore} 超过试卷满分 ${paperTotal}`);
    }

    // 判定是否通过
    const passingScore = getPassingScore(session.exam.passingScore, paperTotal);
    const isPassed = totalScore >= passingScore;

    // 检查是否已有录入（覆盖需审计）
    const existing = await this.prisma.offlineScoreEntry.findUnique({
      where: { sessionId },
    });

    if (existing) {
      // 记录审计日志
      const overrideLog = await this.prisma.scoreAuditLog.create({
        data: {
          examId,
          sessionId,
          studentId: session.studentId,
          action: 'SCORE_OVERRIDE',
          fieldName: 'totalScore',
          oldValue: existing.totalScore,
          newValue: totalScore,
          operatorId: data.enteredBy,
          reason: JSON.stringify({ from: existing.scoreByType, to: data.scoreByType }),
        },
      });
      // 同步写入主审计日志，打通全链审计
      await this.prisma.auditLog.create({
        data: {
          entityType: 'ScoreAuditLog',
          entityId: overrideLog.id,
          action: 'SCORE_OVERRIDE',
          before: { totalScore: existing.totalScore },
          after: { totalScore },
          operatorId: data.enteredBy,
          changeReason: '线下成绩覆盖录入',
          eventSource: 'MANUAL',
        },
      }).catch(() => {});
    }

    // upsert 成绩
    await this.prisma.offlineScoreEntry.upsert({
      where: { sessionId },
      create: {
        examId,
        sessionId,
        studentId: session.studentId,
        scoreByType: data.scoreByType,
        totalScore,
        enteredBy: data.enteredBy,
        graderName: data.graderName || null,
        graderId: data.graderId ?? null,
        gradedAt: data.gradedAt ? new Date(data.gradedAt) : new Date(),
      },
      update: {
        scoreByType: data.scoreByType,
        totalScore,
        enteredBy: data.enteredBy,
        graderName: data.graderName || null,
        graderId: data.graderId ?? null,
        gradedAt: data.gradedAt ? new Date(data.gradedAt) : new Date(),
      },
    });

    // 首次录入也写审计日志
    if (!existing) {
      await this.prisma.scoreAuditLog.create({
        data: {
          examId,
          sessionId,
          studentId: session.studentId,
          action: 'SCORE_ENTRY',
          fieldName: 'totalScore',
          oldValue: null,
          newValue: totalScore,
          operatorId: data.enteredBy,
          reason: JSON.stringify({ scoreByType: data.scoreByType, graderName: data.graderName }),
        },
      }).catch(() => {});
    }

    // 同步更新 ExamSession
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        totalScore,
        finalScore: totalScore,
        isPassed,
        scoringStatus: 'GRADED',
        status: 'SUBMITTED',
      },
    });

    return { sessionId, totalScore, isPassed, passingScore };
  }

  /** 批量导入成绩（严格校验） */
  async batchImportScores(examId: number, entries: Array<{
    studentId: number;
    scoreByType: Record<string, number>;
    graderName?: string;
    gradedAt?: string;
  }>, enteredBy: number) {
    const exam = await this.getOfflineExam(examId);
    if (!['AWAITING_GRADING', 'GRADING_IN_PROGRESS'].includes(exam.status)) {
      throw new BadRequestException('当前状态不允许录入成绩');
    }

    const paper = await this.prisma.paper.findUnique({
      where: { id: exam.paperId },
      include: { questions: { include: { question: { select: { type: true } } } } },
    });
    if (!paper) throw new NotFoundException('关联试卷不存在');

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: { id: true, studentId: true, absent: true },
    });
    const sessionMap = new Map(sessions.map(s => [s.studentId, s]));

    const errors: string[] = [];
    const validEntries: Array<{ session: any; scoreByType: Record<string, number>; graderName?: string; gradedAt?: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const row = i + 1;

      // 校验学员是否存在
      const session = sessionMap.get(entry.studentId);
      if (!session) {
        errors.push(`第${row}行：学员ID ${entry.studentId} 不在本场考试中`);
        continue;
      }

      // 校验缺考
      if (session.absent) {
        errors.push(`第${row}行：学员 ${entry.studentId} 已标记缺考`);
        continue;
      }

      // 校验分数完整性（空值拒绝）
      if (!entry.scoreByType || Object.keys(entry.scoreByType).length === 0) {
        errors.push(`第${row}行：学员 ${entry.studentId} 分数为空，拒绝导入`);
        continue;
      }

      // 校验各题型分数非负
      for (const [type, score] of Object.entries(entry.scoreByType)) {
        if (score == null || score === undefined) {
          errors.push(`第${row}行：学员 ${entry.studentId} 题型 ${type} 分数为空`);
          continue;
        }
        if (score < 0) {
          errors.push(`第${row}行：学员 ${entry.studentId} 题型 ${type} 分数为负数`);
        }
      }

      // 计算总分并校验
      const totalScore = Object.values(entry.scoreByType).reduce((sum, v) => sum + (v || 0), 0);
      if (totalScore > paper.totalScore) {
        errors.push(`第${row}行：学员 ${entry.studentId} 总分 ${totalScore} 超过满分 ${paper.totalScore}`);
        continue;
      }

      validEntries.push({ session, scoreByType: entry.scoreByType, graderName: entry.graderName, gradedAt: entry.gradedAt });
    }

    if (errors.length > 0) {
      return { success: false, errors, importedCount: 0 };
    }

    // 全部校验通过，批量写入
    const passingScore = getPassingScore(exam.passingScore, paper.totalScore);
    let importedCount = 0;

    for (const { session, scoreByType, graderName, gradedAt } of validEntries) {
      const totalScore = Object.values(scoreByType).reduce((sum, v) => sum + (v || 0), 0);
      const isPassed = totalScore >= passingScore;

      await this.prisma.offlineScoreEntry.upsert({
        where: { sessionId: session.id },
        create: {
          examId,
          sessionId: session.id,
          studentId: session.studentId,
          scoreByType,
          totalScore,
          enteredBy,
          graderName: graderName || null,
          gradedAt: gradedAt ? new Date(gradedAt) : new Date(),
        },
        update: {
          scoreByType,
          totalScore,
          enteredBy,
          graderName: graderName || null,
          gradedAt: gradedAt ? new Date(gradedAt) : new Date(),
        },
      });

      await this.prisma.examSession.update({
        where: { id: session.id },
        data: {
          totalScore,
          finalScore: totalScore,
          isPassed,
          scoringStatus: 'GRADED',
          status: 'SUBMITTED',
        },
      });
      importedCount++;
    }

    // 自动流转状态
    if (exam.status === 'AWAITING_GRADING') {
      await this.prisma.exam.update({ where: { id: examId }, data: { status: 'GRADING_IN_PROGRESS' } });
    }

    return { success: true, errors: [], importedCount };
  }

  // ═══════════════════════════════════════════
  // 缺考标记
  // ═══════════════════════════════════════════

  async markAbsent(examId: number, sessionId: number, absent: boolean) {
    const exam = await this.getOfflineExam(examId);
    if (!['PUBLISHED', 'AWAITING_GRADING', 'GRADING_IN_PROGRESS'].includes(exam.status)) {
      throw new BadRequestException('当前状态不允许修改缺考标记（仅在考试发布后至成绩确认前可操作）');
    }
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, examId },
    });
    if (!session) throw new NotFoundException('考试会话不存在');

    if (absent) {
      // 标记缺考：清除已有成绩，状态设为 SUBMITTED（考试已进行，该学员缺考）
      await this.prisma.offlineScoreEntry.deleteMany({ where: { sessionId } });
      await this.prisma.examSession.update({
        where: { id: sessionId },
        data: { absent: true, totalScore: 0, finalScore: 0, isPassed: false, scoringStatus: 'PENDING', status: 'SUBMITTED', submittedAt: new Date() },
      });
    } else {
      await this.prisma.examSession.update({
        where: { id: sessionId },
        data: { absent: false },
      });
    }
    return { sessionId, absent };
  }

  // ═══════════════════════════════════════════
  // 座位号分配
  // ═══════════════════════════════════════════

  /** 自动分配座位号（按学员ID排序） */
  async assignSeats(examId: number, options?: { startFrom?: number }) {
    const exam = await this.getOfflineExam(examId);
    if (!['DRAFT', 'PUBLISHED'].includes(exam.status)) {
      throw new BadRequestException('考试已开始阅卷，不能再分配座位');
    }
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      orderBy: { studentId: 'asc' },
      select: { id: true },
    });

    const startFrom = options?.startFrom ?? 1;
    for (let i = 0; i < sessions.length; i++) {
      await this.prisma.examSession.update({
        where: { id: sessions[i].id },
        data: { seatNumber: startFrom + i },
      });
    }
    return { assigned: sessions.length, startFrom };
  }

  /** 获取座位表数据 */
  async getSeatTable(examId: number) {
    await this.getOfflineExam(examId);
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      orderBy: { seatNumber: 'asc' },
      include: {
        student: { select: { id: true, displayName: true, studentNumber: true } },
      },
    });
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { title: true, startTime: true, endTime: true, locations: true },
    });
    return { exam, sessions };
  }

  // ═══════════════════════════════════════════
  // 查询
  // ═══════════════════════════════════════════

  /** 获取成绩录入列表 */
  async getScoreEntries(examId: number) {
    await this.getOfflineExam(examId);
    return this.prisma.offlineScoreEntry.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, displayName: true, studentNumber: true } },
        enterer: { select: { id: true, displayName: true } },
      },
      orderBy: { enteredAt: 'desc' },
    });
  }

  /** 获取审计日志 */
  async getAuditLogs(examId: number) {
    return this.prisma.scoreAuditLog.findMany({
      where: { examId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 生成导入模板 CSV */
  async getImportTemplate(examId: number): Promise<string> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { paper: { include: { questions: { include: { question: { select: { type: true } } } } } } },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    // 收集题型
    const typeSet = new Set<string>();
    exam.paper?.questions?.forEach(pq => typeSet.add(pq.question.type));
    const types = [...typeSet];

    const typeLabels: Record<string, string> = {
      SINGLE_CHOICE: '单选题',
      MULTIPLE_CHOICE: '多选题',
      TRUE_FALSE: '判断题',
      FILL_BLANK: '填空题',
      SHORT_ANSWER: '简答题',
      CASE_STUDY: '案例分析',
      ESSAY: '论文题',
    };

    // 获取学员列表
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: { student: { select: { id: true, displayName: true, studentNumber: true } } },
      orderBy: { studentId: 'asc' },
    });

    // CSV header
    const header = ['学员ID', '姓名', '学号', ...types.map(t => typeLabels[t] || t), '阅卷人', '阅卷时间'];
    const rows = sessions.map(s => [
      s.student.id,
      s.student.displayName,
      s.student.studentNumber || '',
      ...types.map(() => ''),
      '',
      '',
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  // ═══════════════════════════════════════════
  // 座位表导出
  // ═══════════════════════════════════════════

  /** 导出座位表 Excel */
  async exportSeatTableExcel(examId: number): Promise<Buffer> {
    const { exam, sessions } = await this.getSeatTable(examId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('座位表');

    // 标题
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = exam?.title + ' — 座位表';
    sheet.getCell('A1').font = { size: 14, bold: true };

    // 考试信息
    sheet.getCell('A2').value = '考试时间：' + (exam?.startTime ? new Date(exam.startTime).toLocaleString('zh-CN') : '');
    const locations = exam?.locations as any[];
    if (locations?.length) {
      sheet.getCell('A3').value = '考场：' + locations.map((l: any) => l.name).join('、');
    }

    // 表头
    const headerRow = sheet.addRow([]);
    sheet.addRow([]);
    const cols = ['座位号', '学员ID', '姓名', '学号'];
    const hRow = sheet.addRow(cols);
    hRow.eachCell(cell => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }; });

    // 数据
    sessions.forEach((s: any) => {
      sheet.addRow([s.seatNumber || '', s.student?.id, s.student?.displayName || '', s.student?.studentNumber || '']);
    });

    // 列宽
    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 10;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** 导出座位表 PDF（HTML → Puppeteer） */
  async exportSeatTablePdf(examId: number): Promise<Buffer> {
    const { exam, sessions } = await this.getSeatTable(examId);
    const locations = exam?.locations as any[];

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'SimSun', serif; padding: 40px; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
  .info { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px 10px; text-align: center; }
  th { background: #f5f5f5; font-weight: bold; }
  .footer { margin-top: 30px; font-size: 11px; color: #999; }
</style></head><body>
  <h1>${exam?.title || ''} — 座位安排表</h1>
  <div class="info">
    考试时间：${exam?.startTime ? new Date(exam.startTime).toLocaleString('zh-CN') : ''}
    ${locations?.length ? ' | 考场：' + locations.map((l: any) => l.name).join('、') : ''}
  </div>
  <table>
    <tr><th>座位号</th><th>学员ID</th><th>姓名</th><th>学号</th></tr>
    ${sessions.map((s: any) => '<tr><td>' + (s.seatNumber || '') + '</td><td>' + (s.student?.id || '') + '</td><td>' + (s.student?.displayName || '') + '</td><td>' + (s.student?.studentNumber || '') + '</td></tr>').join('')}
  </table>
  <div class="footer">共 ${sessions.length} 人 | 打印日期：${new Date().toLocaleDateString('zh-CN')}</div>
</body></html>`;

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();
    return Buffer.from(pdf);
  }

  // ═══════════════════════════════════════════
  // 补考机制
  // ═══════════════════════════════════════════

  /** 创建补考（仅一次机会，关联原考试） */
  async createRetake(examId: number, data: {
    startTime: string;
    endTime: string;
    durationMinutes?: number;
    locations?: any;
    createdBy: number;
  }) {
    const exam = await this.getOfflineExam(examId);
    if (!['SCORE_PUBLISHED', 'SCORE_CONFIRMED', 'FINISHED'].includes(exam.status)) {
      throw new BadRequestException('只有成绩已发布/已确认的考试可以创建补考');
    }

    // 查找未通过的学员（含缺考）
    const failedSessions = await this.prisma.examSession.findMany({
      where: { examId, isPassed: false },
      select: { id: true, studentId: true },
    });
    if (failedSessions.length === 0) {
      throw new BadRequestException('没有需要补考的学员（全部已通过）');
    }

    // 检查是否已有补考（只允许一次，通过 originalExamId 关联查询）
    const existingRetake = await this.prisma.exam.findFirst({
      where: { originalExamId: examId },
    });
    if (existingRetake) {
      throw new BadRequestException('该考试已创建过补考，补考仅有一次机会');
    }

    // 创建补考考试（关联原考试ID）
    const retakeExam = await this.prisma.exam.create({
      data: {
        title: exam.title + '（补考）',
        paperId: exam.paperId,
        originalExamId: examId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        durationMinutes: data.durationMinutes || exam.durationMinutes,
        accessType: exam.accessType,
        examMode: 'OFFLINE',
        locations: data.locations ?? exam.locations,
        passingScore: exam.passingScore,
        programId: exam.programId,
        scorePublishMode: exam.scorePublishMode,
        status: 'DRAFT',
        totalStudents: failedSessions.length,
        createdBy: data.createdBy,
        orgId: exam.orgId,
        sessions: {
          create: failedSessions.map(s => ({
            studentId: s.studentId,
            status: 'ASSIGNED',
            attemptNo: 2,
            isRetake: true,
            originalSessionId: s.id,
          })),
        },
      },
      include: { _count: { select: { sessions: true } } },
    });

    return retakeExam;
  }

  /** 获取补考信息 */
  async getRetakeInfo(examId: number) {
    await this.getOfflineExam(examId);
    const failedCount = await this.prisma.examSession.count({
      where: { examId, isPassed: false },
    });
    const retakeExam = await this.prisma.exam.findFirst({
      where: { originalExamId: examId },
    });
    return { failedCount, retakeExam: retakeExam ? { id: retakeExam.id, title: retakeExam.title, status: retakeExam.status } : null };
  }

  // ═══════════════════════════════════════════
  // 复核环节
  // ═══════════════════════════════════════════

  /** 复核成绩 */
  async reviewScore(examId: number, sessionId: number, data: {
    reviewerName: string;
    reviewerId?: number;
    reviewNote?: string;
    approved: boolean;
  }) {
    const exam = await this.getOfflineExam(examId);
    if (!['GRADING_IN_PROGRESS', 'SCORE_CONFIRMED'].includes(exam.status)) {
      throw new BadRequestException('当前状态不允许复核（仅在录入中或已确认阶段可操作）');
    }
    const entry = await this.prisma.offlineScoreEntry.findUnique({ where: { sessionId } });
    if (!entry) throw new NotFoundException('该学员尚未录入成绩');

    await this.prisma.offlineScoreEntry.update({
      where: { sessionId },
      data: {
        reviewerName: data.reviewerName,
        reviewerId: data.reviewerId ?? null,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote || null,
        status: data.approved ? 'CONFIRMED' : 'DRAFT',
      },
    });

    return { sessionId, reviewed: true, approved: data.approved };
  }

  // ═══════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════

  private async getOfflineExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { program: { select: { orgId: true } } }, // ★ 2026-08-16 证书申请机构归属解析
    });
    if (!exam) throw new NotFoundException('考试不存在');
    if (exam.examMode !== 'OFFLINE') throw new BadRequestException('该考试不是线下笔试');
    return exam;
  }
}
