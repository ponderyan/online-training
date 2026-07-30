import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions, ROLE_PERMISSIONS } from '../../common/permissions.constants.js';
import { requestContext } from '../../common/utils/request-context.js';
import { SUBJECTIVE_TYPES, recalculateSessionScore, getPassingScore } from '../../common/grading.utils.js';
import { ExamAccessService } from '../../common/services/exam-access.service.js';

@Controller('api/grading')
export class GradingController {
  constructor(private prisma: PrismaService, private certService: CertificatesService, private notificationService: NotificationsService, private examAccess: ExamAccessService) {}

  /** 获取某场考试的所有待阅卷学员（按分派隔离） */
  @Get(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getGradingList(@Param('examId', ParseIntPipe) examId: number, @Req() req: any) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: {
          include: {
            questions: {
              include: { question: { select: { type: true } } },
            },
          },
        },
      },
    });
    const subjectivePQIds = new Set(
      exam?.paper?.questions
        ?.filter(pq => SUBJECTIVE_TYPES.has(pq.question.type))
        .map(pq => pq.id) || [],
    );

    // 分派隔离：非考务员（EXAM_OFFICER/SUPER_ADMIN）只能看自己分派的学员
    const userRoles: string[] = req.user?.roles || [];
    const userId = req.user?.sub || req.user?.id;
    const isOfficer = userRoles.some(r => {
      const perms = ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS];
      return perms?.includes(Permissions.GRADING_PUBLISH);
    });

    const sessionWhere: any = { examId, status: 'SUBMITTED' };

    if (!isOfficer) {
      // 查自己被分派了哪些学员
      const myAssignments = await this.prisma.gradingAssignment.findMany({
        where: { examId, graderId: userId },
      });

      const assignedSessionIds = myAssignments
        .filter(a => a.sessionId !== null)
        .map(a => a.sessionId);

      if (assignedSessionIds.length > 0) {
        sessionWhere.id = { in: assignedSessionIds };
      } else if (myAssignments.length === 0) {
        // 没有被分派任何东西
        return [];
      }
      // else: 只有按题型分派（sessionId=null），不按学员过滤
    }

    const sessions = await this.prisma.examSession.findMany({
      where: sessionWhere,
      include: {
        student: { select: { id: true, displayName: true, username: true } },
        answers: {
          where: {
            paperQuestionId: { in: [...subjectivePQIds] },
            score: null,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return sessions.map(s => ({
      sessionId: s.id,
      student: s.student,
      totalScore: s.totalScore,
      finalScore: s.finalScore,
      isPassed: s.isPassed,
      submittedAt: s.submittedAt,
      scoringStatus: s.scoringStatus,
      pendingCount: subjectivePQIds.size > 0 ? s.answers.length : 0,
    }));
  }

  /** ★ 按题批阅：获取某道主观题的所有学员答案（流水阅卷模式） */
  @Get(':examId/by-question/:pqId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getAnswersByQuestion(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('pqId', ParseIntPipe) pqId: number,
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    // 获取题目信息
    const pq = await this.prisma.paperQuestion.findUnique({
      where: { id: pqId },
      include: {
        question: {
          include: { options: { orderBy: { sortOrder: 'asc' } }, subQuestions: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!pq) return { error: '题目不存在' };

    // 分派隔离：非考务员检查是否被分派该题
    const userRoles: string[] = req.user?.roles || [];
    const userId = req.user?.sub || req.user?.id;
    const isOfficer = userRoles.some(r => {
      const perms = ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS];
      return perms?.includes(Permissions.GRADING_PUBLISH);
    });

    let sessionFilter: any = { examId, status: 'SUBMITTED' };
    if (!isOfficer) {
      const myAssignments = await this.prisma.gradingAssignment.findMany({
        where: { examId, graderId: userId },
      });
      // 检查是否有该题的分派（paperQuestionId=pqId 或 null=全部题）
      const hasQuestionAssignment = myAssignments.some(a => a.paperQuestionId === pqId || a.paperQuestionId === null);
      if (!hasQuestionAssignment && myAssignments.length > 0) {
        return { error: '你未被分派评阅此题' };
      }
      if (myAssignments.length === 0) return { error: '你未被分派任何阅卷任务' };
      // 如果有按学员的分派，过滤 session
      const assignedSessionIds = myAssignments.filter(a => a.sessionId !== null).map(a => a.sessionId);
      if (assignedSessionIds.length > 0) {
        sessionFilter.id = { in: assignedSessionIds };
      }
    }

    // 获取所有已提交学员对该题的答案
    const sessions = await this.prisma.examSession.findMany({
      where: sessionFilter,
      select: { id: true, studentId: true, student: { select: { id: true, displayName: true } }, scoringStatus: true },
      orderBy: { submittedAt: 'asc' },
    });
    const sessionIds = sessions.map(s => s.id);

    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId: { in: sessionIds }, paperQuestionId: pqId },
      orderBy: { id: 'asc' },
    });

    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    return {
      question: {
        pqId: pq.id,
        questionId: pq.questionId,
        type: pq.question.type,
        content: pq.question.content,
        maxScore: pq.score,
        analysis: pq.question.analysis,
        subQuestions: pq.question.subQuestions,
        rubric: pq.rubric || [],
      },
      answers: answers.map(a => {
        const session = sessionMap.get(a.sessionId);
        return {
          answerId: a.id,
          sessionId: a.sessionId,
          studentId: session?.studentId,
          studentName: session?.student?.displayName || '未知',
          answer: a.answer,
          score: a.score,
          graderNote: a.graderNote,
          graded: a.score !== null,
        };
      }),
      total: answers.length,
      gradedCount: answers.filter(a => a.score !== null).length,
      pendingCount: answers.filter(a => a.score === null).length,
    };
  }

  /** ★ 每题统计分析：平均分、得分率、分布 */
  @Get(':examId/question-stats')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getQuestionStats(@Param('examId', ParseIntPipe) examId: number, @Req() req: any) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { paper: { include: { questions: { include: { question: true } } } } },
    });
    if (!exam) return { error: '考试不存在' };

    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { id: true },
    });
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length === 0) return { stats: [], totalStudents: 0 };

    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { paperQuestionId: true, score: true, isCorrect: true },
    });

    // 按题目分组统计
    const pqMap = new Map<number, { scores: number[]; correct: number; total: number }>();
    for (const a of answers) {
      if (!pqMap.has(a.paperQuestionId)) pqMap.set(a.paperQuestionId, { scores: [], correct: 0, total: 0 });
      const entry = pqMap.get(a.paperQuestionId)!;
      entry.total++;
      if (a.score !== null) entry.scores.push(a.score);
      if (a.isCorrect) entry.correct++;
    }

    const stats = (exam.paper?.questions || []).map((pq: any) => {
      const entry = pqMap.get(pq.id) || { scores: [], correct: 0, total: 0 };
      const maxScore = pq.score;
      const avg = entry.scores.length > 0 ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : 0;
      const scoreRate = maxScore > 0 ? (avg / maxScore) * 100 : 0;
      const max = entry.scores.length > 0 ? Math.max(...entry.scores) : 0;
      const min = entry.scores.length > 0 ? Math.min(...entry.scores) : 0;
      // 分数段分布（0-25%, 25-50%, 50-75%, 75-100%）
      const dist = [0, 0, 0, 0];
      for (const s of entry.scores) {
        const pct = maxScore > 0 ? s / maxScore : 0;
        if (pct <= 0.25) dist[0]++;
        else if (pct <= 0.5) dist[1]++;
        else if (pct <= 0.75) dist[2]++;
        else dist[3]++;
      }
      return {
        pqId: pq.id,
        questionId: pq.questionId,
        type: pq.question?.type,
        content: pq.question?.content?.slice(0, 50),
        maxScore,
        totalStudents: entry.total,
        gradedCount: entry.scores.length,
        avgScore: Math.round(avg * 10) / 10,
        scoreRate: Math.round(scoreRate * 10) / 10,
        maxScoreGot: max,
        minScoreGot: min,
        correctRate: entry.total > 0 ? Math.round((entry.correct / entry.total) * 1000) / 10 : null,
        distribution: dist,
      };
    });

    return { stats, totalStudents: sessionIds.length };
  }

  /** 设置/更新评分 Rubric（扣分点） */
  @Put(':examId/rubric/:pqId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async setRubric(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('pqId', ParseIntPipe) pqId: number,
    @Body() data: { rubric: { description: string; points: number; type: 'add' | 'deduct' }[] },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const pq = await this.prisma.paperQuestion.findUnique({ where: { id: pqId } });
    if (!pq) return { error: '题目不存在' };
    // 验证 rubric 格式
    if (!Array.isArray(data.rubric)) return { error: 'rubric 必须为数组' };
    for (const item of data.rubric) {
      if (!item.description || typeof item.points !== 'number' || !['add', 'deduct'].includes(item.type)) {
        return { error: 'rubric 项格式错误：需 {description, points, type:add|deduct}' };
      }
    }
    await this.prisma.paperQuestion.update({ where: { id: pqId }, data: { rubric: data.rubric } });
    return { success: true, rubric: data.rubric };
  }

  /** 获取某个学员的完整答卷（含所有答案） */
  @Get(':examId/:studentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getStudentAnswers(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const [session, paper] = await Promise.all([
      this.prisma.examSession.findUnique({
        where: { examId_studentId: { examId, studentId } },
        include: { answers: { orderBy: { id: 'asc' } } },
      }),
      this.prisma.paper.findFirst({
        where: { exams: { some: { id: examId } } },
        include: {
          questions: {
            include: {
              question: {
                include: {
                  options: { orderBy: { sortOrder: 'asc' } },
                  subQuestions: { orderBy: { sortOrder: 'asc' } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
    ]);
    if (!session) return { error: '考试记录不存在' };
    if (session.scoringStatus === 'CONFIRMED') return { error: '成绩已锁存，如需调整请先解锁' };

    // 权限校验：非考务员只能查看自己被分派的学员答卷
    const userRoles: string[] = req.user?.roles || [];
    const userId = req.user?.sub || req.user?.id;
    const isOfficer = userRoles.some(r => {
      const perms = ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS];
      return perms?.includes(Permissions.GRADING_PUBLISH);
    });

    if (!isOfficer) {
      const assignment = await this.prisma.gradingAssignment.findFirst({
        where: {
          examId,
          graderId: userId,
          OR: [
            { sessionId: session.id },           // 这位学员的具体分派（含指定题目）
            { sessionId: null, paperQuestionId: null },  // 全学员全主观题
          ],
        },
      });
      if (!assignment) {
        return { error: '你未被分派查看该学员的答卷' };
      }
    }

    const pqList: any[] = paper?.questions || [];

    return {
      examTitle: paper?.name || '',
      studentId,
      sessionId: session.id,
      totalScore: session.totalScore,
      subjectiveScore: session.subjectiveScore,
      finalScore: session.finalScore,
      isPassed: session.isPassed,
      scoringStatus: session.scoringStatus,
      answers: session.answers.map(a => {
        const pq = pqList.find(q => q.id === a.paperQuestionId);
        const q = pq?.question;
        return {
          answerId: a.id,
          questionId: a.questionId,
          paperQuestionId: a.paperQuestionId,
          type: q?.type,
          content: q?.content,
          score: a.score,
          isCorrect: a.isCorrect,
          yourAnswer: a.answer,
          graderNote: a.graderNote,
          maxScore: pq?.score || 0,
          options: q?.options,
          subQuestions: q?.subQuestions,
          analysis: q?.analysis,
        };
      }),
    };
  }

  /** 对一道主观题评分 */
  @Put(':examId/:studentId/:answerId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async gradeAnswer(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() data: { score: number; graderNote?: string },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const answer = await this.prisma.examAnswer.findUnique({ where: { id: answerId } });
    if (!answer) return { error: '答案不存在' };

    // 权限校验：非考务员需要检查是否有分派
    const userRoles: string[] = req.user?.roles || [];
    const userId = req.user?.sub || req.user?.id;
    const isOfficer = userRoles.some(r => {
      const perms = ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS];
      return perms?.includes(Permissions.GRADING_PUBLISH);
    });

    if (!isOfficer) {
      // 查出该答案的 examId 和 paperQuestionId
      const session = await this.prisma.examSession.findUnique({
        where: { id: answer.sessionId },
        select: { examId: true },
      });

      const assignment = await this.prisma.gradingAssignment.findFirst({
        where: {
          examId: session!.examId,
          graderId: userId,
          OR: [
            { sessionId: answer.sessionId, paperQuestionId: answer.paperQuestionId },
            { sessionId: answer.sessionId, paperQuestionId: null },
            { sessionId: null, paperQuestionId: answer.paperQuestionId },
            { sessionId: null, paperQuestionId: null },
          ],
        },
      });

      if (!assignment) {
        return { error: '你未被分派评分此答案' };
      }
    }

    // ★ 校验评分不超过该题满分
    const pq = await this.prisma.paperQuestion.findUnique({
      where: { id: answer.paperQuestionId },
      select: { score: true },
    });
    const maxScore = pq?.score ?? 0;
    if (data.score < 0) return { error: '评分不能为负数' };
    if (data.score > maxScore) return { error: `评分不能超过该题满分 ${maxScore} 分` };

    await this.prisma.examAnswer.update({
      where: { id: answerId },
      data: { score: data.score, graderNote: data.graderNote || null },
    });

    // 使用共享方法重算 ExamSession 成绩字段
    const result = await recalculateSessionScore(this.prisma, answer.sessionId);
    // AUTO 模式：检查全部评完后自动发布
    // 查出 examId（沿用 gradeAnswer 已有的 session 查询）
    const gSession = await this.prisma.examSession.findUnique({
      where: { id: answer.sessionId },
      select: { examId: true },
    });
    if (gSession) await this.autoPublishIfModeMatches(gSession.examId);

    // P2-2: 更新 GradingAssignment 状态 — 检查该阅卷员在该考试的分派是否已全部完成
    if (gSession && !isOfficer) {
      void this.updateAssignmentProgress(gSession.examId, userId);
    }

    return { success: true, ...result };
  }

  /** 成绩发布 */
  @Post(':examId/publish')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  async publishResults(@Param('examId', ParseIntPipe) examId: number, @Req() req?: any) {
    if (req?.user) await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    // 获取该场考试的主观题列表
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: {
          include: {
            questions: {
              include: { question: { select: { type: true } } },
            },
          },
        },
      },
    });
    const subjectivePQIds = exam?.paper?.questions
      ?.filter(pq => SUBJECTIVE_TYPES.has(pq.question.type))
      .map(pq => pq.id) || [];

    // 检查所有已提交学员的主观题是否已评分
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { id: true },
    });
    const sessionIds = sessions.map(s => s.id);

    // 只检查主观题类型的未评分答案
    const ungraded = subjectivePQIds.length > 0
      ? await this.prisma.examAnswer.count({
          where: {
            sessionId: { in: sessionIds },
            paperQuestionId: { in: subjectivePQIds },
            score: null,
          },
        })
      : 0;

    if (ungraded > 0) {
      return { error: `还有 ${ungraded} 道主观题未评分，请评完后再发布` };
    }

    // ✅ 真正写入数据库 — 仅发布已判完的卷（GRADED），与 publishScores 逻辑对齐
    const result = await this.prisma.examSession.updateMany({
      where: { id: { in: sessionIds }, scoringStatus: 'GRADED' },
      data: {
        scoringStatus: 'PUBLISHED',
        scoringPublishedAt: new Date(),
      },
    });
    if (result.count === 0) {
      return { error: '没有已判完的成绩可发布（需所有主观题评完后 scoringStatus=GRADED）' };
    }

    // ← 通知所有学员成绩已发布
    const allSubmitted = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { studentId: true },
    });
    void this.notificationService.createMany(
      allSubmitted.map(s => s.studentId),
      'EXAM_PUBLISHED' as any,
      `成绩已发布`,
      `【${exam?.title || ''}】成绩已发布，请查看`,
      examId, 'exam',
    );

    // ← 自动为通过的学员创建证书申请
    const passedSessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', isPassed: true },
      select: { id: true, studentId: true, finalScore: true },
    });
    let certDraftCount = 0;
    for (const s of passedSessions) {
      const existing = await this.prisma.certificateApplication.findFirst({
        where: { sessionId: s.id, status: { not: 'REJECTED' } },
      });
      if (existing) continue;
      await this.prisma.certificateApplication.create({
        data: { sessionId: s.id, studentId: s.studentId, status: 'PENDING' },
      });
      certDraftCount++;
    }

    return { success: true, message: '成绩已发布', certDraftCount };
  }

  /** 成绩确认/锁存 → 自动为通过的学员发证 */
  @Post(':examId/confirm')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  async confirmScores(@Param('examId', ParseIntPipe) examId: number, @Req() req: any) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const result = await this.prisma.examSession.updateMany({
      where: { examId, scoringStatus: 'PUBLISHED' },
      data: { scoringStatus: 'CONFIRMED', confirmedAt: new Date() },
    });

    // ← 通知学员成绩已确认
    void (async () => {
      const confirmed = await this.prisma.examSession.findMany({
        where: { examId, scoringStatus: 'CONFIRMED' },
        select: { studentId: true },
      });
      await this.notificationService.createMany(
        confirmed.map(s => s.studentId),
        'EXAM_CONFIRMED' as any,
        `成绩已确认`,
        `成绩已确认锁存`,
        examId, 'exam',
      );
    })();

    // 自动发证：找到通过的学员，审批 PENDING 证书申请并生成证书
    let certIssued = 0, certSkipped = 0;
    const passedSessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED', isPassed: true, scoringStatus: 'CONFIRMED' },
      select: { id: true, studentId: true },
    });

    for (const s of passedSessions) {
      const app = await this.prisma.certificateApplication.findFirst({
        where: { sessionId: s.id, status: 'PENDING' },
      });
      if (!app) { certSkipped++; continue; }
      try {
        await this.certService.issueSingleCertificate(s.id, s.studentId, { userOrgId: req.user?.orgId ?? null, userRoles: req.user?.roles || [] });
        await this.prisma.certificateApplication.update({
          where: { id: app.id },
          data: { status: 'APPROVED' },
        });
        await this.prisma.certificateApprovalLog.create({
          data: {
            certificateId: app.id,
            action: 'AUTO_APPROVED',
            operatorId: 0,
            operatorName: '系统自动',
            note: '成绩确认后自动审批发证',
          },
        });
        certIssued++;
      } catch { certSkipped++; }
    }

    return {
      success: true,
      message: `已确认 ${result.count} 份成绩`,
      certIssued,
      certSkipped,
    };
  }

  /** 解锁成绩 */
  @Post(':examId/unlock')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  async unlockScores(@Param('examId', ParseIntPipe) examId: number, @Body() data: { reason: string; operatorId: number; operatorName: string }, @Req() req: any) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const store = requestContext.getStore();
    if (store) requestContext.enterWith({ ...store, changeReason: data.reason });
    const result = await this.prisma.examSession.updateMany({
      where: { examId, scoringStatus: 'CONFIRMED' },
      data: { scoringStatus: 'PUBLISHED', confirmedAt: null },
    });
    // Record audit
    const unlockLog = await this.prisma.scoreAuditLog.create({
      data: { examId, studentId: 0, action: 'UNLOCK', reason: 'UNLOCK: ' + data.reason, operatorId: data.operatorId, operatorName: data.operatorName || '管理员' },
    });
    // 同步写入主审计日志
    await this.prisma.auditLog.create({
      data: {
        entityType: 'ScoreAuditLog',
        entityId: unlockLog.id,
        action: 'UNLOCK',
        before: { scoringStatus: 'CONFIRMED', count: result.count },
        after: { scoringStatus: 'PUBLISHED', count: result.count },
        operatorId: data.operatorId,
        operatorName: data.operatorName || '管理员',
        changeReason: data.reason,
        eventSource: 'MANUAL',
      },
    });
    return { success: true, message: `已解锁 ${result.count} 份成绩` };
  }

  /** 成绩调整（含审计日志） */
  @Post(':examId/:studentId/adjust')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async adjustScore(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() data: { adjustedScore: number; reason: string; operatorId: number; operatorName: string },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(examId, req.user?.orgId ?? null, req.user?.roles);
    const store = requestContext.getStore();
    if (store) requestContext.enterWith({ ...store, changeReason: data.reason });
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { exam: { include: { paper: true } } },
    });
    if (!session) return { error: '考试记录不存在' };
    if (session.scoringStatus === 'CONFIRMED') return { error: '成绩已锁存，如需调整请先解锁' };

    const originalScore = session.finalScore || session.totalScore || 0;

    // 从 Exam 表读取 passingScore（统一工具函数）
    const passingScore = getPassingScore(session?.exam?.passingScore, session?.exam?.paper?.totalScore);

    // 写入成绩审计日志
    const scoreAuditLog = await this.prisma.scoreAuditLog.create({
      data: {
        examId,
        studentId,
        action: 'ADJUST',
        fieldName: 'finalScore',
        oldValue: originalScore,
        newValue: data.adjustedScore,
        reason: data.reason,
        operatorId: data.operatorId,
        operatorName: data.operatorName || '管理员',
      },
    });

    // 同步写入主审计日志，打通两条审计线（全链审计可从 audit_logs 直接查到成绩调整）
    await this.prisma.auditLog.create({
      data: {
        entityType: 'ScoreAuditLog',
        entityId: scoreAuditLog.id,
        action: 'SCORE_ADJUST',
        before: { score: originalScore, status: session.scoringStatus },
        after: { score: data.adjustedScore, status: 'ADJUSTED' },
        operatorId: data.operatorId,
        operatorName: data.operatorName || '管理员',
        changeReason: data.reason,
        eventSource: 'MANUAL',
      },
    });

    // 更新成绩 + 状态流转（PUBLISHED → ADJUSTED，需重新发布）
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        finalScore: data.adjustedScore,
        isPassed: data.adjustedScore >= passingScore,
        scoringStatus: session.scoringStatus === 'PUBLISHED' ? 'ADJUSTED' : undefined,
      },
    });

    // 成绩变更通知
    void this.notificationService.create(
      studentId,
      'EXAM_GRADED' as any,
      `成绩已调整`,
      `【${session?.exam?.title || ''}】成绩已从 ${originalScore} 分调整为 ${data.adjustedScore} 分。原因：${data.reason || '无'}`,
      examId, 'exam',
    );

    return { success: true, originalScore, adjustedScore: data.adjustedScore };
  }


  /** P2-2: 检查阅卷员分派进度，全部评完则标记 COMPLETED */
  private async updateAssignmentProgress(examId: number, graderId: number) {
    try {
      const assignments = await this.prisma.gradingAssignment.findMany({
        where: { examId, graderId, status: { not: 'COMPLETED' } },
      });
      if (assignments.length === 0) return;

      // 获取该考试的主观题 paperQuestionIds
      const paper = await this.prisma.paper.findFirst({
        where: { exams: { some: { id: examId } } },
        include: { questions: { include: { question: { select: { type: true } } } } },
      });
      const subjectivePQIds = new Set(
        paper?.questions?.filter(pq => SUBJECTIVE_TYPES.has(pq.question.type)).map(pq => pq.id) || [],
      );

      for (const assignment of assignments) {
        // 确定该分派覆盖的学员 session
        const sessionWhere: any = { examId, status: 'SUBMITTED' };
        if (assignment.sessionId) sessionWhere.id = assignment.sessionId;

        const sessions = await this.prisma.examSession.findMany({
          where: sessionWhere, select: { id: true },
        });
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length === 0) {
          await this.prisma.gradingAssignment.update({ where: { id: assignment.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
          continue;
        }

        // 确定该分派覆盖的题目
        const pqFilter = assignment.paperQuestionId
          ? [assignment.paperQuestionId]
          : [...subjectivePQIds];

        // 检查是否还有未评分的答案
        const ungraded = await this.prisma.examAnswer.count({
          where: {
            sessionId: { in: sessionIds },
            paperQuestionId: { in: pqFilter },
            score: null,
          },
        });

        if (ungraded === 0) {
          await this.prisma.gradingAssignment.update({
            where: { id: assignment.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        } else if (assignment.status === 'PENDING') {
          await this.prisma.gradingAssignment.update({
            where: { id: assignment.id },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }
    } catch { /* 进度更新失败不影响评分主流程 */ }
  }

  /** 如果考试模式是 AUTO，检查所有学员主观题是否已评完 */
  private async autoPublishIfModeMatches(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { scorePublishMode: true },
    });
    if (exam?.scorePublishMode !== 'AUTO') return;

    // 查该考试的所有已提交学员是否还有未评的主观题
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { id: true },
    });
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length === 0) return;

    const paper = await this.prisma.paper.findFirst({
      where: { exams: { some: { id: examId } } },
      include: { questions: { include: { question: { select: { type: true } } } } },
    });
    const subjectivePQIds = paper?.questions
      ?.filter(pq => SUBJECTIVE_TYPES.has(pq.question.type))
      .map(pq => pq.id) || [];
    if (subjectivePQIds.length === 0) return; // 纯客观题由 autoGrade 处理

    const ungraded = await this.prisma.examAnswer.count({
      where: {
        sessionId: { in: sessionIds },
        paperQuestionId: { in: subjectivePQIds },
        score: null,
      },
    });
    if (ungraded === 0) {
      await this.publishResults(examId);
    }
  }

}
