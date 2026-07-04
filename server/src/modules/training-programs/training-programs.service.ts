import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TrainingProgramsService {
  constructor(private prisma: PrismaService) {}

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear().toString();
    const last = await this.prisma.trainingProgram.findFirst({
      where: { code: { startsWith: `DT-TC-${year}-` } },
      orderBy: { code: 'desc' },
    });
    let seq = 1;
    if (last) {
      const parts = last.code.split('-');
      seq = parseInt(parts[3] || '0', 10) + 1;
    }
    return `DT-TC-${year}-${String(seq).padStart(3, '0')}`;
  }

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; subjectId?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.subjectId) where.subjectId = params.subjectId;

    const [items, total] = await Promise.all([
      this.prisma.trainingProgram.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.trainingProgram.count({ where }),
    ]);

    // Get enrollment counts
    const enrollCounts = await this.prisma.programEnrollment.groupBy({
      by: ['programId'],
      _count: true,
    });
    const countMap = new Map(enrollCounts.map(e => [e.programId, e._count]));
    const subjects = await this.prisma.dataDictionary.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    return {
      items: items.map(p => ({
        ...p, enrolledCount: countMap.get(p.id) || 0, subject: subjectMap.get(p.subjectId) || null,
      })),
      total, page, pageSize, totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('培训班不存在');
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { programId: id },
      include: { agency: true },
    });
    // Get student info
    const userIds = enrollments.map(e => e.studentId);
    const users = userIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, username: true, phone: true, organization: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const subjects = await this.prisma.dataDictionary.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    return {
      ...program,
      enrolledCount: enrollments.length,
      enrollments: enrollments.map(e => ({ ...e, student: userMap.get(e.studentId) || null })),
      subject: subjectMap.get(program.subjectId) || null,
    };
  }

  async create(data: any) {
    data.code = await this.generateCode();
    if (!data.createdBy) data.createdBy = 1; // default to admin
    // 日期字段转换（前端可能传 "YYYY-MM-DD" 格式）
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.enrollStart) data.enrollStart = new Date(data.enrollStart);
    if (data.enrollEnd) data.enrollEnd = new Date(data.enrollEnd);
    return this.prisma.trainingProgram.create({ data });
  }

  async update(id: number, data: any) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    if (program.status !== 'PREPARING' && program.status !== 'ENROLLING') throw new BadRequestException('只能编辑筹备或报名中的培训班');
    const upd: any = {};
    const fields = ['name', 'courseName', 'subjectId', 'description', 'location', 'maxStudents', 'headTeacher', 'remark',
      'tuitionFee', 'examFee', 'certFee'];
    for (const f of fields) { if (data[f] !== undefined) upd[f] = data[f]; }
    if (data.startDate) upd.startDate = new Date(data.startDate);
    if (data.endDate) upd.endDate = new Date(data.endDate);
    if (data.enrollStart) upd.enrollStart = new Date(data.enrollStart);
    if (data.enrollEnd) upd.enrollEnd = new Date(data.enrollEnd);
    return this.prisma.trainingProgram.update({ where: { id }, data: upd });
  }

  async delete(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    if (program.status !== 'PREPARING') throw new BadRequestException('只能删除筹备中的培训班');
    return this.prisma.trainingProgram.delete({ where: { id } });
  }

  async updateStatus(id: number, status: string, operatorId?: number, reason?: string) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    const validTransitions: Record<string, string[]> = {
      PREPARING: ['ENROLLING', 'CANCELLED'], ENROLLING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['REVIEWING'], REVIEWING: ['CERTIFYING', 'PREPARING'],
      CERTIFYING: ['COMPLETED'], COMPLETED: [], CANCELLED: [],
    };
    if (!validTransitions[program.status]?.includes(status)) {
      throw new BadRequestException(`不能从 ${program.status} 转为 ${status}`);
    }
    const result = await this.prisma.trainingProgram.update({ where: { id }, data: { status: status as any } });
    // 写入状态变更日志
    await this.prisma.programStatusLog.create({
      data: { programId: id, fromStatus: program.status as any, toStatus: status as any, operatorId: operatorId || 1, reason: reason || null },
    }).catch(() => {});
    return result;
  }

  async getAvailableActions(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id }, select: { status: true } });
    if (!program) return [];
    const actionMap: Record<string, { label: string; target: string; confirm?: string }[]> = {
      PREPARING: [{ label: '开放报名', target: 'ENROLLING', confirm: '确认开放报名？报名开始后学员可自主报名。' }],
      ENROLLING: [{ label: '开始培训', target: 'IN_PROGRESS', confirm: '确认开始培训？开课后将锁定学员名单。' }],
      IN_PROGRESS: [{ label: '提交审核', target: 'REVIEWING', confirm: '确认提交审核？提交后等待协会审核。' }],
      REVIEWING: [
        { label: '批准发证', target: 'CERTIFYING', confirm: '确认批准发证？将触发证书批量生成。' },
        { label: '退回筹备', target: 'PREPARING', confirm: '退回到筹备阶段？退回后可修改信息重新提交。' },
      ],
      CERTIFYING: [{ label: '完成结业', target: 'COMPLETED', confirm: '确认完成结业？此操作不可逆。' }],
    };
    return actionMap[program.status] || [];
  }

  // ═══════════════════════════════════════════
  //   仪表盘统计
  // ═══════════════════════════════════════════

  async getDashboard(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!program) throw new NotFoundException('培训班不存在');

    // ── 并行查询所有数据 ──
    const [
      enrollCountResult,
      examStatsResult,
      scoreDistResult,
      typeAccResult,
      certCountResult,
      leaderboardResult,
    ] = await Promise.all([
      // 1. 报名人数
      this.prisma.programEnrollment.count({ where: { programId: id } }),

      // 2. 参考人数 & 通过人数（一次查询）
      this.prisma.$queryRawUnsafe<{ exam_count: bigint; pass_count: bigint }[]>(`
        SELECT
          COUNT(DISTINCT es.student_id) as exam_count,
          COUNT(DISTINCT CASE WHEN es.final_score >= COALESCE(e.passing_score, 60) THEN es.student_id END) as pass_count
        FROM exam_sessions es
        JOIN exams e ON es.exam_id = e.id
        WHERE e.program_id = ? AND es.submitted_at IS NOT NULL
      `, id),

      // 3. 分数段分布（取每个学员的最高分）
      this.prisma.$queryRawUnsafe<{ score_range: string; count: bigint }[]>(`
        SELECT
          CASE
            WHEN best_score < 60 THEN '0-59'
            WHEN best_score < 70 THEN '60-69'
            WHEN best_score < 80 THEN '70-79'
            WHEN best_score < 90 THEN '80-89'
            ELSE '90-100'
          END as score_range,
          COUNT(*) as count
        FROM (
          SELECT es.student_id, MAX(es.final_score) as best_score
          FROM exam_sessions es
          JOIN exams e ON es.exam_id = e.id
          WHERE e.program_id = ? AND es.final_score IS NOT NULL
          GROUP BY es.student_id
        ) t
        GROUP BY score_range
        ORDER BY score_range
      `, id),

      // 4. 题型正确率
      this.prisma.$queryRawUnsafe<{ type: string; total_count: bigint; correct_count: bigint }[]>(`
        SELECT q.type,
          COUNT(ea.id) as total_count,
          SUM(CASE WHEN ea.is_correct = true THEN 1 ELSE 0 END) as correct_count
        FROM exam_answers ea
        JOIN exam_sessions ses ON ea.session_id = ses.id
        JOIN exams e ON ses.exam_id = e.id
        JOIN questions q ON ea.question_id = q.id
        WHERE e.program_id = ? AND ea.is_correct IS NOT NULL
        GROUP BY q.type
      `, id),

      // 5. 已出证人数
      this.prisma.certificate.count({ where: { programId: id, isRevoked: false } }),

      // 6. 排行榜 TOP 10
      this.prisma.$queryRawUnsafe<{ student_id: number; display_name: string; best_score: number }[]>(`
        SELECT u.id as student_id, u.display_name, MAX(es.final_score) as best_score
        FROM exam_sessions es
        JOIN exams e ON es.exam_id = e.id
        JOIN users u ON es.student_id = u.id
        WHERE e.program_id = ? AND es.final_score IS NOT NULL
        GROUP BY u.id, u.display_name
        ORDER BY best_score DESC
        LIMIT 10
      `, id),
    ]);

    // ── 解析参考/通过 ──
    const examCount = Number(examStatsResult[0]?.exam_count || 0);
    const passCount = Number(examStatsResult[0]?.pass_count || 0);

    // ── 分数段 ──
    const allRanges = ['0-59', '60-69', '70-79', '80-89', '90-100'];
    const scoreDistMap = new Map((scoreDistResult || []).map(r => [r.score_range, Number(r.count)]));
    const scoreDistribution = allRanges.map(range => ({
      range,
      count: scoreDistMap.get(range) || 0,
    }));

    // ── 题型正确率 ──
    const typeLabels: Record<string, string> = {
      SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
      FILL_BLANK: '填空', SHORT_ANSWER: '问答', CASE_STUDY: '案例',
    };
    const typeAccuracy = (typeAccResult || []).map(r => {
      const total = Number(r.total_count);
      const correct = Number(r.correct_count);
      return {
        type: r.type,
        label: typeLabels[r.type] || r.type,
        total,
        correct,
        rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });

    // ── 排行榜（补充证书状态） ──
    const studentIds = (leaderboardResult || []).map(r => r.student_id);
    const certMap = new Map<number, boolean>();
    if (studentIds.length > 0) {
      const certs = await this.prisma.certificate.findMany({
        where: { programId: id, studentId: { in: studentIds }, isRevoked: false },
        select: { studentId: true },
      });
      certs.forEach(c => certMap.set(c.studentId, true));
    }
    const leaderboard = (leaderboardResult || []).map((r, i) => ({
      rank: i + 1,
      studentId: r.student_id,
      studentName: r.display_name,
      score: r.best_score,
      certStatus: certMap.has(r.student_id) ? '已发放' : '—',
    }));

    return {
      overview: {
        enrollCount: enrollCountResult,
        examCount,
        passCount,
        passRate: examCount > 0 ? Math.round((passCount / examCount) * 100) : null,
      },
      scoreDistribution,
      typeAccuracy,
      funnel: {
        enrolled: enrollCountResult,
        examined: examCount,
        passed: passCount,
        certified: Number(certCountResult),
      },
      leaderboard,
    };
  }

  async enrollStudents(id: number, studentIds: number[], agencyId?: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id }, select: { status: true } });
    if (!program) throw new NotFoundException('培训班不存在');
    if (program.status !== 'ENROLLING') throw new BadRequestException('当前状态不允许报名，仅 ENROLLING 状态可报名');
    let enrolled = 0, skipped = 0;
    for (const studentId of studentIds) {
      const existing = await this.prisma.programEnrollment.findUnique({
        where: { programId_studentId: { programId: id, studentId } },
      });
      if (existing) { skipped++; continue; }
      await this.prisma.programEnrollment.create({ data: { programId: id, studentId, agencyId: agencyId || undefined } });
      enrolled++;
    }
    return { enrolled, skipped, total: enrolled + skipped };
  }
}
