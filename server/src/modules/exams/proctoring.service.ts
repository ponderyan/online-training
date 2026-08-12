import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExamsService } from './exams.service.js';
import { emitExamChanged } from '../../common/events/app-events.js';

const ONLINE_THRESHOLD_SECONDS = 30;

@Injectable()
export class ProctoringService {
  constructor(
    private prisma: PrismaService,
    private examsService: ExamsService,
  ) {}

  async getOverview(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { _count: { select: { sessions: true } } },
    });
    const totalStudents = exam?._count?.sessions || 0;

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: { id: true, status: true, lastHeartbeatAt: true, suspicionLevel: true, absent: true },
    });

    const now = new Date();
    let onlineCount = 0, offlineCount = 0, submittedCount = 0, abnormalCount = 0, absentCount = 0;

    for (const s of sessions) {
      if (s.absent) absentCount++;
      if (s.status === 'SUBMITTED') {
        submittedCount++;
        continue;
      }
      if (s.suspicionLevel > 0) abnormalCount++;

      if (s.status === 'ACTIVE') {
        const isOnline = s.lastHeartbeatAt &&
          (now.getTime() - new Date(s.lastHeartbeatAt).getTime()) / 1000 < ONLINE_THRESHOLD_SECONDS;
        if (isOnline) onlineCount++;
        else offlineCount++;
      } else {
        offlineCount++;
      }
    }

    return { totalStudents, onlineCount, offlineCount, submittedCount, abnormalCount, absentCount };
  }

  /**
   * ★ 监考大屏（座舱模式）聚合数据
   * 一次请求返回考试基本信息 + 全局统计 + 全员卡片 + 最近违规动态
   */
  async getBoard(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { paper: { select: { name: true, totalScore: true } } },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    const questionCount = await this.prisma.paperQuestion.count({ where: { paperId: exam.paperId } });

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: { student: { select: { displayName: true, organization: true } } },
      orderBy: { id: 'asc' },
    });

    const now = new Date();
    let onlineCount = 0, offlineCount = 0, submittedCount = 0, absentCount = 0, abnormalCount = 0, notStartedCount = 0;
    const recentViolations: Array<{ sessionId: number; studentName: string; time: string; action: string }> = [];

    const items = sessions.map(s => {
      const isOnline = s.status === 'ACTIVE' && s.lastHeartbeatAt &&
        (now.getTime() - new Date(s.lastHeartbeatAt).getTime()) / 1000 < ONLINE_THRESHOLD_SECONDS;
      const tabSwitchCount = Array.isArray(s.violationLog) ? s.violationLog.length : 0;

      if (s.absent) absentCount++;
      if (s.status === 'SUBMITTED') submittedCount++;
      else if (s.status === 'ACTIVE') (isOnline ? onlineCount++ : offlineCount++);
      else notStartedCount++;
      if (s.suspicionLevel > 0) abnormalCount++;

      if (Array.isArray(s.violationLog)) {
        for (const entry of s.violationLog as any[]) {
          recentViolations.push({
            sessionId: s.id,
            studentName: s.student?.displayName || '未知',
            time: entry.timestamp || entry.time || '',
            action: entry.action || 'tab_switch',
          });
        }
      }

      return {
        sessionId: s.id,
        studentName: s.student?.displayName || '未知',
        organization: s.student?.organization || '',
        status: s.status,
        absent: s.absent,
        online: isOnline,
        suspicionLevel: s.suspicionLevel,
        tabSwitchCount,
        remainingTime: s.remainingTime,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        totalScore: s.totalScore,
      };
    });

    recentViolations.sort((a, b) => (b.time || '').localeCompare(a.time || ''));

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        examMode: exam.examMode,
        timeMode: exam.timeMode,
        accessType: exam.accessType,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMinutes: exam.durationMinutes,
        passingScore: exam.passingScore,
        tabSwitchLimit: exam.tabSwitchLimit,
        paperName: exam.paper?.name || '',
        paperTotalScore: exam.paper?.totalScore || 0,
        questionCount,
      },
      stats: {
        totalStudents: sessions.length,
        onlineCount,
        offlineCount,
        notStartedCount,
        submittedCount,
        absentCount,
        abnormalCount,
        submissionRate: sessions.length > 0 ? Math.round((submittedCount / sessions.length) * 100) : 0,
      },
      sessions: items,
      recentViolations: recentViolations.slice(0, 20),
      serverTime: now,
    };
  }

  /**
   * ★ 违规记录导出（2026-08-12）：violationLog + 监考操作留痕合一表
   * 返回 CSV 文本（UTF-8 BOM，Excel 直接打开中文不乱码）
   */
  async exportViolationsCsv(examId: number): Promise<string> {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { title: true } });
    if (!exam) throw new NotFoundException('考试不存在');

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: { student: { select: { displayName: true, organization: true } } },
    });

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmt = (t: unknown) => (t ? new Date(t as string).toLocaleString('zh-CN', { hour12: false }) : '');

    const rows: string[][] = [['考生', '所属机构', '记录类型', '详情', '操作人', '时间']];
    for (const s of sessions) {
      const name = s.student?.displayName || '未知';
      const org = s.student?.organization || '';
      if (Array.isArray(s.violationLog)) {
        for (const entry of s.violationLog as any[]) {
          const action = entry.action === 'tab_switch' || !entry.action ? '切屏' : entry.action;
          rows.push([name, org, '违规', action, '—', fmt(entry.timestamp || entry.time)]);
        }
      }
      if (Array.isArray(s.proctorActions)) {
        for (const a of s.proctorActions as any[]) {
          rows.push([name, org, '监考操作', `${a.action}${a.message ? '：' + a.message : ''}`, a.operatorName || '', fmt(a.timestamp)]);
        }
      }
    }
    rows.sort((a, b) => (b[5] || '').localeCompare(a[5] || ''));
    // 表头保持首行
    const header = rows.shift()!;
    return '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
  }

  async getSessions(examId: number, params: {
    status?: string; keyword?: string;
    page?: number; pageSize?: number;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const now = new Date();

    // Get all sessions for this exam
    const where: any = { examId };

    const sessions = await this.prisma.examSession.findMany({
      where,
      include: {
        student: { select: { id: true, displayName: true, organization: true } },
      },
      orderBy: { id: 'asc' },
    });

    // Enrich with online status
    let items = sessions.map(s => {
      const isOnline = s.status === 'ACTIVE' && s.lastHeartbeatAt &&
        (now.getTime() - new Date(s.lastHeartbeatAt).getTime()) / 1000 < ONLINE_THRESHOLD_SECONDS;
      const tabSwitchCount = Array.isArray(s.violationLog) ? s.violationLog.length : 0;

      return {
        sessionId: s.id,
        studentId: s.studentId,
        studentName: s.student?.displayName || '未知',
        organization: s.student?.organization || '',
        status: s.status,
        absent: s.absent,
        online: isOnline,
        suspicionLevel: s.suspicionLevel,
        violationLog: s.violationLog,
        tabSwitchCount,
        totalScore: s.totalScore,
        remainingTime: s.remainingTime,
        lastHeartbeatAt: s.lastHeartbeatAt,
        startedAt: s.createdAt,
        submittedAt: s.submittedAt,
      };
    });

    // Apply filters
    if (params.status) {
      items = items.filter(s => {
        if (params.status === 'ONLINE') return s.online;
        if (params.status === 'OFFLINE') return !s.online && s.status !== 'SUBMITTED';
        if (params.status === 'ABNORMAL') return s.suspicionLevel > 0;
        if (params.status === 'SUBMITTED') return s.status === 'SUBMITTED';
        if (params.status === 'ACTIVE') return s.status === 'ACTIVE';
        if (params.status === 'ABSENT') return s.absent;
        return true;
      });
    }
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(s => s.studentName.toLowerCase().includes(kw) || s.organization.toLowerCase().includes(kw));
    }

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return { items: paged, total, page, pageSize };
  }

  async getSessionDetail(examId: number, sessionId: number) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, displayName: true, organization: true } },
        exam: { select: { title: true, durationMinutes: true } },
      },
    });
    if (!session) throw new NotFoundException('考试记录不存在');

    const now = new Date();
    const isOnline = session.status === 'ACTIVE' && session.lastHeartbeatAt &&
      (now.getTime() - new Date(session.lastHeartbeatAt).getTime()) / 1000 < ONLINE_THRESHOLD_SECONDS;
    const tabSwitchCount = Array.isArray(session.violationLog) ? session.violationLog.length : 0;

    // Parse violation log into timeline
    const tabSwitchTimeline = Array.isArray(session.violationLog)
      ? session.violationLog.map((entry: any) => ({
          time: entry.timestamp || entry.time || new Date().toISOString(),
          action: entry.action || 'tab_switch',
        }))
      : [];

    return {
      sessionId: session.id,
      studentId: session.studentId,
      studentName: session.student?.displayName || '未知',
      organization: session.student?.organization || '',
      status: session.status,
      absent: session.absent,
      online: isOnline,
      suspicionLevel: session.suspicionLevel,
      violationLog: session.violationLog,
      tabSwitchCount,
      tabSwitchTimeline,
      totalScore: session.totalScore,
      finalScore: session.finalScore,
      remainingTime: session.remainingTime,
      lastHeartbeatAt: session.lastHeartbeatAt,
      startedAt: session.createdAt,
      submittedAt: session.submittedAt,
      proctorActions: session.proctorActions,
      examTitle: session.exam?.title || '',
      durationMinutes: session.exam?.durationMinutes || 0,
    };
  }

  async sendMessage(examId: number, sessionId: number, data: {
    messageType: string;
    content: string;
    senderName: string;
  }) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('考试记录不存在');

    // 1. 写入 exam_messages 表（消息通道）
    const msg = await this.prisma.examMessage.create({
      data: {
        examSessionId: sessionId,
        messageType: data.messageType,
        content: data.content,
        senderName: data.senderName,
      },
    });

    // 2. 保留审计日志（proctorActions）
    const action = { timestamp: new Date().toISOString(), action: data.messageType, message: data.content, operatorName: data.senderName };
    const existingActions = Array.isArray(session.proctorActions) ? session.proctorActions : [];
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { proctorActions: [...existingActions, action] },
    });

    return msg;
  }

  async warn(examId: number, sessionId: number, message: string, operatorName: string) {
    const result = await this.sendMessage(examId, sessionId, { messageType: 'WARN', content: message, senderName: operatorName });
    emitExamChanged(examId); // 监考大屏实时推送：警告
    return result;
  }

  async getMessages(examId: number, sessionId: number) {
    return this.prisma.examMessage.findMany({
      where: { examSessionId: sessionId },
      orderBy: { sentAt: 'asc' },
    });
  }

  async forceSubmit(examId: number, sessionId: number, reason: string, operatorName: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { exam: true },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.status === 'SUBMITTED') throw new BadRequestException('该考生已交卷');

    // Auto-grade existing answers
    await this.examsService.autoGrade(session.id);

    const action = { timestamp: new Date().toISOString(), action: 'FORCE_SUBMIT', message: reason, operatorName };
    const existingActions = Array.isArray(session.proctorActions) ? session.proctorActions : [];

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        proctorActions: [...existingActions, action],
      },
    });

    // ★ 统一收口：重算 submittedCount（避免并发计数偏移）
    await this.examsService.syncExamProgress(examId);
    emitExamChanged(examId); // 监考大屏实时推送：强制交卷

    return { success: true, finalScore: session.finalScore || session.totalScore };
  }

  async extendTime(examId: number, sessionId: number, extraSeconds: number, reason: string, operatorName: string) {
    if (extraSeconds > 600) throw new BadRequestException('单次延长最多 10 分钟（600 秒）');
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.status === 'SUBMITTED') throw new BadRequestException('该考生已交卷，无法延长时间');

    const newRemainingTime = (session.remainingTime || 0) + extraSeconds;
    const action = { timestamp: new Date().toISOString(), action: 'EXTEND_TIME', message: `${reason}（+${extraSeconds}秒）`, operatorName };
    const existingActions = Array.isArray(session.proctorActions) ? session.proctorActions : [];

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        remainingTime: newRemainingTime,
        proctorActions: [...existingActions, action],
      },
    });

    emitExamChanged(examId); // 监考大屏实时推送：延长作答时间
    return { success: true, newRemainingTime };
  }

  /**
   * 人工标记/撤销缺考（线上监考）
   * - 标记缺考：仅对未开考（ASSIGNED/PAUSED）会话
   * - 撤销缺考：恢复 ASSIGNED、清除 0 分记录，学员可重新进入考试
   */
  async toggleAbsent(examId: number, sessionId: number, absent: boolean, operatorName: string) {
    const session = await this.prisma.examSession.findFirst({ where: { id: sessionId, examId } });
    if (!session) throw new NotFoundException('考试会话不存在');

    if (absent) {
      if (session.absent) throw new BadRequestException('该考生已被标记缺考');
      if (session.status === 'ACTIVE') throw new BadRequestException('考生正在作答中，请使用强制交卷');
      if (session.status === 'SUBMITTED') throw new BadRequestException('考生已交卷，不能标记缺考');
      await this.prisma.examSession.update({
        where: { id: sessionId },
        data: { absent: true, status: 'SUBMITTED', submittedAt: new Date(), totalScore: 0, finalScore: 0, isPassed: false },
      });
    } else {
      if (!session.absent) throw new BadRequestException('该考生未被标记缺考');
      // 坑2：考试已结束（endTime 已过）时撤销缺考无意义——定期结算会再次将其标记缺考，且学员也无法重新作答
      const examRow = await this.prisma.exam.findUnique({ where: { id: examId }, select: { endTime: true } });
      if (examRow && examRow.endTime <= new Date()) {
        throw new BadRequestException('考试已结束，请先延长考试时间再撤销缺考');
      }
      await this.prisma.examSession.update({
        where: { id: sessionId },
        data: { absent: false, status: 'ASSIGNED', submittedAt: null, totalScore: null, finalScore: null, isPassed: null, scoringStatus: 'PENDING' },
      });
    }

    // 审计日志
    const action = { timestamp: new Date().toISOString(), action: absent ? 'MARK_ABSENT' : 'REVOKE_ABSENT', message: absent ? '人工标记缺考' : '撤销缺考标记', operatorName };
    const existingActions = Array.isArray(session.proctorActions) ? session.proctorActions : [];
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { proctorActions: [...existingActions, action] },
    });

    // ★ 统一收口：重算 submittedCount 与考试状态
    if (absent) {
      await this.examsService.syncExamProgress(examId);
    } else {
      // 坑1：撤销缺考需显式将 FINISHED 回退为 IN_PROGRESS（学员重新可考）；syncExamProgress 只前进不回退，故此处不能省略
      await this.prisma.exam.update({
        where: { id: examId },
        data: { status: 'IN_PROGRESS' },
      });
      await this.examsService.syncExamProgress(examId);
    }

    emitExamChanged(examId); // 监考大屏实时推送：标记/撤销缺考
    return { sessionId, absent };
  }
}
