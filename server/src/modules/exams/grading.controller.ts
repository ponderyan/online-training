import { Controller, Get, Post, Put, Param, Body, ParseIntPipe, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions, ROLE_PERMISSIONS } from '../../common/permissions.constants.js';
import { SUBJECTIVE_TYPES, recalculateSessionScore } from '../../common/grading.utils.js';

@Controller('api/grading')
export class GradingController {
  constructor(private prisma: PrismaService, private certService: CertificatesService, private notificationService: NotificationsService) {}

  /** 获取某场考试的所有待阅卷学员（按分派隔离） */
  @Get(':examId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getGradingList(@Param('examId', ParseIntPipe) examId: number, @Req() req: any) {
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

  /** 获取某个学员的完整答卷（含所有答案） */
  @Get(':examId/:studentId')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getStudentAnswers(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Req() req: any,
  ) {
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
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() data: { score: number; graderNote?: string },
    @Req() req: any,
  ) {
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

    await this.prisma.examAnswer.update({
      where: { id: answerId },
      data: { score: data.score, graderNote: data.graderNote || null },
    });

    // 使用共享方法重算 ExamSession 成绩字段
    const result = await recalculateSessionScore(this.prisma, answer.sessionId);

    return { success: true, ...result };
  }

  /** 成绩发布 */
  @Post(':examId/publish')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  async publishResults(@Param('examId', ParseIntPipe) examId: number) {
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

    // ✅ 真正写入数据库
    await this.prisma.examSession.updateMany({
      where: { id: { in: sessionIds } },
      data: {
        scoringStatus: 'PUBLISHED',
        scoringPublishedAt: new Date(),
      },
    });

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
  async confirmScores(@Param('examId', ParseIntPipe) examId: number) {
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
        await this.certService.issueSingleCertificate(s.id, s.studentId);
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
  async unlockScores(@Param('examId', ParseIntPipe) examId: number, @Body() data: { reason: string; operatorId: number; operatorName: string }) {
    const result = await this.prisma.examSession.updateMany({
      where: { examId, scoringStatus: 'CONFIRMED' },
      data: { scoringStatus: 'PUBLISHED', confirmedAt: null },
    });
    // Record audit
    await this.prisma.scoreAuditLog.create({
      data: { examId, studentId: 0, action: 'UNLOCK', reason: 'UNLOCK: ' + data.reason, operatorId: data.operatorId, operatorName: data.operatorName || '管理员' },
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
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { exam: { include: { paper: true } } },
    });
    if (!session) return { error: '考试记录不存在' };
    if (session.scoringStatus === 'CONFIRMED') return { error: '成绩已锁存，如需调整请先解锁' };

    const originalScore = session.finalScore || session.totalScore || 0;

    // 从 Exam 表读取 passingScore
    const paperTotal = session?.exam?.paper?.totalScore || 100;
    const passingScore = session?.exam?.passingScore ?? Math.floor(paperTotal * 0.6);

    // 写入审计日志
    await this.prisma.scoreAuditLog.create({
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

    // 更新成绩 + 状态流转（PUBLISHED → ADJUSTED，需重新发布）
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        finalScore: data.adjustedScore,
        isPassed: data.adjustedScore >= passingScore,
        scoringStatus: session.scoringStatus === 'PUBLISHED' ? 'ADJUSTED' : undefined,
      },
    });

    return { success: true, originalScore, adjustedScore: data.adjustedScore };
  }

}
