import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SUBJECTIVE_TYPES } from '../../common/grading.utils.js';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private systemConfig: SystemConfigService,
    private notificationService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════
  //  场次管理（教务端）
  // ═══════════════════════════════════════════

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; paperId?: number; programId?: number; userOrgId?: number | null; userRoles?: string[] }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.title = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.paperId) where.paperId = params.paperId;
    if (params.programId) where.programId = params.programId;

    // ★ orgId 隔离
    const uOrgId = params.userOrgId ?? null;
    const uRoles = params.userRoles ?? [];
    if (uRoles.includes('SUPER_ADMIN')) {
      const visibility = await this.systemConfig.getConfig('org_bank_visibility');
      if (visibility === 'hidden') where.orgId = null;
    } else if (uOrgId) {
      where.orgId = uOrgId;
    }

    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          paper: { select: { id: true, name: true, totalScore: true } },
          _count: { select: { sessions: true } },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        paper: { include: { subject: { select: { name: true } }, questions: { include: { question: { include: { options: true, blanks: true, subQuestions: true } } } } } },
        program: { select: { id: true, name: true, code: true } },
        sessions: {
          include: { student: { select: { id: true, displayName: true } }, answers: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    // ★ orgId 隔离：非 SUPER_ADMIN 只能访问自己机构的
    if (userRoles && userRoles.length > 0 && !userRoles.includes('SUPER_ADMIN')) {
      const uOrgId = userOrgId ?? null;
      if (uOrgId === null || exam.orgId !== uOrgId) {
        throw new NotFoundException('考试不存在');
      }
    }

    return exam;
  }

  async create(data: {
    title: string; paperId: number; createdBy: number;
    startTime: string; endTime: string; durationMinutes: number;
    accessType?: string; shuffleQuestions?: boolean; shuffleOptions?: boolean;
    password?: string;
    programId?: number; passingScore?: number;
    timeMode?: string; paperMode?: string;
    tabSwitchLimit?: number; copyProtection?: boolean; autoSaveInterval?: number;
    orgId?: number | null;
    scorePublishMode?: string;
    publishAt?: string;
  }) {
    const paper = await this.prisma.paper.findUnique({ where: { id: data.paperId } });
    if (!paper) throw new NotFoundException('试卷不存在');

    // 如果有 programId，从培训班学员中选取
    let students: { id: number }[];
    if (data.programId) {
      const enrollments = await this.prisma.programEnrollment.findMany({
        where: { programId: data.programId },
        select: { studentId: true },
      });
      students = enrollments.map(e => ({ id: e.studentId }));
    } else {
      // 从 UserRoleAssignment 查询学员
      const studentRole = await this.prisma.role.findUnique({ where: { code: 'STUDENT' } });
      const studentAssignments = studentRole
        ? await this.prisma.userRoleAssignment.findMany({ where: { roleId: studentRole.id }, select: { userId: true } })
        : [];
      students = await this.prisma.user.findMany({
        where: { id: { in: studentAssignments.map(a => a.userId) }, isActive: true },
        select: { id: true },
      });
    }

    return this.prisma.exam.create({
      data: {
        title: data.title,
        paperId: data.paperId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        durationMinutes: data.durationMinutes,
        accessType: data.accessType as any || 'UNIFIED',
        shuffleQuestions: data.shuffleQuestions ?? true,
        shuffleOptions: data.shuffleOptions ?? true,
        password: data.password || null,
        programId: data.programId || null,
        passingScore: data.passingScore ?? undefined,
        timeMode: (data.timeMode as any) || 'FIXED',
        paperMode: (data.paperMode as any) || 'SAME',
        tabSwitchLimit: data.tabSwitchLimit ?? 5,
        copyProtection: data.copyProtection ?? true,
        autoSaveInterval: data.autoSaveInterval ?? 30,
        scorePublishMode: data.scorePublishMode || 'MANUAL',
        publishAt: data.publishAt ? new Date(data.publishAt) : null,
        status: 'DRAFT',
        totalStudents: students.length,
        createdBy: data.createdBy,
        orgId: data.orgId ?? null,
        sessions: {
          create: students.map(s => ({
            studentId: s.id,
            status: 'ASSIGNED',
          })),
        },
      },
      include: {
        paper: { select: { id: true, name: true } },
        _count: { select: { sessions: true } },
      },
    });
  }

  async update(id: number, data: any, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(id, userOrgId, userRoles);
    if (exam.status !== 'DRAFT') throw new BadRequestException('只有草稿状态的考试可以编辑');
    const updateData: any = {};
    if (data.title) updateData.title = data.title;
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    if (data.durationMinutes) updateData.durationMinutes = data.durationMinutes;
    if (data.accessType) updateData.accessType = data.accessType;
    if (data.shuffleQuestions !== undefined) updateData.shuffleQuestions = data.shuffleQuestions;
    if (data.shuffleOptions !== undefined) updateData.shuffleOptions = data.shuffleOptions;
    if (data.timeMode) updateData.timeMode = data.timeMode;
    if (data.paperMode) updateData.paperMode = data.paperMode;
    if (data.tabSwitchLimit !== undefined) updateData.tabSwitchLimit = data.tabSwitchLimit;
    if (data.copyProtection !== undefined) updateData.copyProtection = data.copyProtection;
    if (data.autoSaveInterval !== undefined) updateData.autoSaveInterval = data.autoSaveInterval;
    return this.prisma.exam.update({ where: { id }, data: updateData });
  }

  async remove(id: number, userOrgId?: number | null, userRoles?: string[]) {
    await this.findOne(id, userOrgId, userRoles);
    return this.prisma.exam.delete({ where: { id } });
  }

  async publish(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(id, userOrgId, userRoles);
    if (exam.status !== 'DRAFT') throw new BadRequestException('只能发布草稿状态的考试');

    // 发布后通知所有已分配学员
    const sessions = await this.prisma.examSession.findMany({
      where: { examId: id },
      select: { studentId: true },
    });
    const studentIds = [...new Set(sessions.map(s => s.studentId))];
    if (studentIds.length > 0) {
      void this.notificationService.createMany(
        studentIds,
        'EXAM_PUBLISHED' as any,
        `考试已发布「${exam.title}」`,
        `考试已发布，请及时参加：${exam.title}`,
        id, 'exam',
      );
    }

    return this.prisma.exam.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async finish(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(id, userOrgId, userRoles);
    if (exam.status === 'FINISHED') throw new BadRequestException('考试已结束');
    await this.prisma.examSession.updateMany({
      where: { examId: id, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    // 统一收口：强制置 FINISHED，并按 session 实际状态重算 submittedCount
    await this.syncExamProgress(id, true);
    return this.prisma.exam.findUnique({ where: { id } });
  }

  /**
   * 统一收口：以 examSession 实际状态为准，重算 exam.submittedCount 并推进 exam.status。
   *
   * 设计原则：submittedCount / status 都是 examSession 的派生数据。
   * 不再让各提交入口（submitExam / heartbeat / forceSubmit / finish）各自手工维护，
   * 全部委托给本方法，以 examSession 表作为唯一真相源，避免缓存与事实脱节。
   *
   * @param forceFinish 强制置为 FINISHED（admin「结束考试」使用，不论是否全员交完）
   */
  async syncExamProgress(examId: number, forceFinish = false) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { status: true, totalStudents: true },
    });
    if (!exam) return;

    // submittedCount 直接按 session 表重新统计，永远反映真实情况
    const submittedCount = await this.prisma.examSession.count({
      where: { examId, status: 'SUBMITTED' },
    });

    let nextStatus = exam.status;
    if (forceFinish) {
      nextStatus = 'FINISHED';
    } else if (
      exam.totalStudents > 0 &&
      submittedCount >= exam.totalStudents &&
      exam.status !== 'FINISHED'
    ) {
      // 全员交完自动收卷（兼容 PUBLISHED / IN_PROGRESS 两种来路）
      nextStatus = 'FINISHED';
    }

    await this.prisma.exam.update({
      where: { id: examId },
      data: { submittedCount, status: nextStatus },
    });
  }

  async getStudents(id: number) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId: id },
      include: { student: { select: { id: true, displayName: true, username: true, organization: true } } },
      orderBy: { id: 'asc' },
    });
    return sessions;
  }

  async addStudents(examId: number, studentIds: number[]) {
    const exam = await this.findOne(examId);
    const existing = await this.prisma.examSession.findMany({
      where: { examId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map(s => s.studentId));
    const newIds = studentIds.filter(id => !existingIds.has(id));
    if (newIds.length > 0) {
      await this.prisma.examSession.createMany({
        data: newIds.map(sid => ({ examId, studentId: sid, status: 'ASSIGNED' })),
      });
    }
    return this.prisma.exam.update({
      where: { id: examId },
      data: { totalStudents: { increment: newIds.length } },
    });
  }

  // ═══════════════════════════════════════════
  //  学员端
  // ═══════════════════════════════════════════

  async getStudentExams(studentId: number) {
    const sessions = await this.prisma.examSession.findMany({
      where: { studentId },
      include: {
        exam: { include: { paper: { select: { id: true, name: true, totalScore: true, durationMinutes: true } } } },
      },
      orderBy: { exam: { startTime: 'desc' } },
    });
    return sessions.map(s => ({
      id: s.exam.id,
      title: s.exam.title,
      status: s.exam.status,
      paperName: s.exam.paper.name,
      totalScore: s.exam.paper.totalScore,
      durationMinutes: s.exam.paper.durationMinutes,
      startTime: s.exam.startTime,
      endTime: s.exam.endTime,
      accessType: s.exam.accessType,
      sessionStatus: s.status,
      remainingTime: s.remainingTime,
      scoringStatus: s.scoringStatus,
      myScore: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.totalScore : null,
      myFinalScore: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.finalScore : null,
      isPassed: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.isPassed : null,
      submittedAt: s.submittedAt,
    }));
  }

  async startExam(examId: number, studentId: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(examId, userOrgId, userRoles);
    if (exam.status !== 'PUBLISHED' && exam.status !== 'IN_PROGRESS') throw new BadRequestException('考试未开放');

    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { answers: true },
    });
    if (!session) throw new ForbiddenException('你没有被分配该考试');
    if (session.status === 'SUBMITTED') throw new BadRequestException('你已提交答卷');

    let questionsData: any;
    if (session.status === 'ACTIVE') {
      questionsData = this.prepareExamQuestions(exam, session);
    } else if (session.status === 'PAUSED') {
      if (exam.timeMode === 'FIXED') throw new BadRequestException('统一开考模式不允许暂停续答');
      await this.prisma.examSession.update({ where: { id: session.id }, data: { status: 'ACTIVE' } });
      questionsData = this.prepareExamQuestions(exam, session);
    } else if (session.status === 'ASSIGNED') {
      const now = new Date();
      const initialTime = (exam.durationMinutes || 60) * 60;
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', startedAt: now, remainingTime: initialTime },
      });
      session.status = 'ACTIVE';
      session.startedAt = now;
      session.remainingTime = initialTime;
      // 第一个学员开考 → 考试状态推进到 IN_PROGRESS
      if (exam.status === 'PUBLISHED') {
        await this.prisma.exam.update({ where: { id: examId }, data: { status: 'IN_PROGRESS' } });
      }
      questionsData = this.prepareExamQuestions(exam, session);
    } else {
      throw new BadRequestException('考试状态异常，无法开始');
    }

    // 补充考生信息和考试属性
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, displayName: true, studentNumber: true, avatar: true, gender: true },
    });

    return {
      ...questionsData,
      isOpenBook: exam.isOpenBook,
      openBookRules: exam.openBookRules,
      autoSaveInterval: exam.autoSaveInterval,
      studentInfo: student ? {
        displayName: student.displayName,
        studentNumber: student.studentNumber,
        avatar: student.avatar,
        gender: student.gender,
      } : null,
    };
  }

  async submitExam(examId: number, studentId: number, answers: { questionId: number; paperQuestionId: number; answer: any }[], tabSwitchLog?: any[]) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { answers: true, exam: true },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.status === 'SUBMITTED') throw new BadRequestException('已提交，不可重复提交');
    if (session.exam.endTime && new Date() > new Date(session.exam.endTime)) throw new BadRequestException('考试已结束，无法提交');
    if (session.remainingTime !== null && session.remainingTime <= 0) throw new BadRequestException('考试时间已到，无法提交');

    for (const ans of answers) {
      await this.prisma.examAnswer.upsert({
        where: { sessionId_paperQuestionId: { sessionId: session.id, paperQuestionId: ans.paperQuestionId } },
        create: { sessionId: session.id, questionId: ans.questionId, paperQuestionId: ans.paperQuestionId, answer: ans.answer },
        update: { answer: ans.answer },
      });
    }

    // 先标记为已交卷 + 待评阅（PENDING 兜底，含主观题时保持此状态等人工）
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: 'SUBMITTED', submittedAt: new Date(), scoringStatus: 'PENDING',
        violationLog: tabSwitchLog ? tabSwitchLog as any : undefined,
      },
    });

    // autoGrade 在最后执行：纯客观题设 GRADED，AUTO 模式设 PUBLISHED，覆盖上面的 PENDING；
    // 含主观题时 autoGrade 不碰 scoringStatus，保留 PENDING（待人工评阅）。
    await this.autoGrade(session.id);

    // 统一收口：重算 submittedCount，并在全员交完时推进到 FINISHED
    await this.syncExamProgress(examId);

    return { success: true };
  }

  async saveSingleAnswer(
    examId: number,
    studentId: number,
    data: { questionId: number; paperQuestionId: number; answer: any },
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      select: { id: true, status: true, remainingTime: true },
    });

    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.status === 'SUBMITTED') throw new BadRequestException('考试已提交，无法保存答案');
    if (session.remainingTime !== null && session.remainingTime <= 0) {
      throw new BadRequestException('考试时间已到');
    }

    await this.prisma.examAnswer.upsert({
      where: { sessionId_paperQuestionId: { sessionId: session.id, paperQuestionId: data.paperQuestionId } },
      create: { sessionId: session.id, questionId: data.questionId, paperQuestionId: data.paperQuestionId, answer: data.answer },
      update: { answer: data.answer },
    });

    return { success: true, savedAt: new Date().toISOString() };
  }

  async heartbeat(examId: number, studentId: number, tabSwitchData?: any[]) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session || session.status !== 'ACTIVE') {
      return {
        ok: false,
        remainingTime: Math.max(0, session?.remainingTime || 0),
        sessionStatus: session?.status || 'TERMINATED',
      };
    }

    const updateData: any = {
      lastHeartbeatAt: new Date(),
    };

    // 递减剩余时间
    if (session.remainingTime !== null && session.remainingTime > 0) {
      updateData.remainingTime = Math.max(0, session.remainingTime - 30);
    }

    // ★ 检测剩余时间归零 → 自动交卷
    if (updateData.remainingTime === 0 || session.remainingTime === 0) {
      // 先标记交卷 + PENDING 兜底，再 autoGrade 覆盖正确的 scoringStatus（与 submitExam 一致）
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), scoringStatus: 'PENDING' },
      });
      await this.autoGrade(session.id);
      // 统一收口：重算 submittedCount 并在全员交完时推进 FINISHED
      await this.syncExamProgress(examId);
      return {
        ok: false,
        remainingTime: 0,
        sessionStatus: 'SUBMITTED',
      };
    }

    // === 时间提醒：当剩余时间跨阈值时自动创建消息 ===
    if (session.remainingTime !== null && updateData.remainingTime !== undefined) {
      const REMINDER_THRESHOLDS = [600, 300, 60];
      const REMINDER_MESSAGES: Record<number, string> = {
        600: '⏰ 距考试结束还有 10 分钟，请抓紧时间！',
        300: '⏰ 距考试结束还有 5 分钟，请准备提交答案。',
        60: '⏰ 距考试结束还有 1 分钟，系统将自动交卷！',
      };
      const existingAuto = await this.prisma.examMessage.findMany({
        where: { examSessionId: session.id, messageType: 'AUTO_REMINDER' },
        select: { content: true },
      });
      const sentThresholds = new Set(
        existingAuto.map(m => {
          const match = m.content.match(/@threshold:(\d+)/);
          return match ? parseInt(match[1]) : null;
        }).filter((t): t is number => t !== null)
      );
      for (const threshold of REMINDER_THRESHOLDS) {
        if (updateData.remainingTime <= threshold && !sentThresholds.has(threshold)) {
          await this.prisma.examMessage.create({
            data: {
              examSessionId: session.id,
              messageType: 'AUTO_REMINDER',
              content: `${REMINDER_MESSAGES[threshold]} @threshold:${threshold}`,
              senderName: '系统',
            },
          });
          sentThresholds.add(threshold);
        }
      }
    }

    // 追加切屏数据到 violationLog
    if (tabSwitchData && tabSwitchData.length > 0) {
      const existingLog = Array.isArray(session.violationLog) ? session.violationLog : [];
      updateData.violationLog = [...existingLog, ...tabSwitchData];
      // 累计切屏次数到 suspicionLevel
      updateData.suspicionLevel = (session.suspicionLevel || 0) + tabSwitchData.length;
    }

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: updateData,
    });

    // 查询未读消息
    const unreadMessages = await this.prisma.examMessage.findMany({
      where: { examSessionId: session.id, readAt: null },
      orderBy: { sentAt: 'asc' },
      select: { id: true, messageType: true, content: true, senderName: true, sentAt: true },
    });

    return {
      ok: true,
      remainingTime: updateData.remainingTime,
      sessionStatus: session.status,
      messages: unreadMessages,
    };
  }

  async markMessageRead(examId: number, studentId: number, messageId: number) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session) throw new NotFoundException('考试记录不存在');

    await this.prisma.examMessage.updateMany({
      where: { id: messageId, examSessionId: session.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async getResult(examId: number, studentId: number, viewerId?: number) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: {
        answers: true,
        exam: {
          include: {
            paper: {
              include: {
                questions: {
                  include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } }, blanks: { orderBy: { blankIndex: 'asc' } }, subQuestions: { orderBy: { sortOrder: 'asc' } } } } },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('考试记录不存在');

    // 学生自查看 — 检查成绩是否已发布
    const isStudentViewing = !viewerId || viewerId === studentId;
    if (isStudentViewing) {
      const published = session.scoringStatus === 'PUBLISHED' || session.scoringStatus === 'ADJUSTED' || session.scoringStatus === 'CONFIRMED';
      if (!published) {
        return {
          examTitle: session.exam.title,
          submittedAt: session.submittedAt,
          scoringStatus: session.scoringStatus,
          published: false,
          message: '成绩尚未发布，请等待管理员发布成绩',
        };
      }
    }

    // Determine if viewer can see full results
    let showFull = true;
    const vId = viewerId || studentId;
    if (vId === studentId) {
      // Student viewing their own result
      if (!(session.exam as any).showAnswerAfterExam) {
        showFull = false;
      }
    }

    // Compute stats
    const totalQuestions = session.exam.paper.questions.length;
    const correctCount = session.answers.filter(a => a.isCorrect === true).length;
    const wrongCount = session.answers.filter(a => a.isCorrect === false).length;
    const pendingCount = session.answers.filter(a => a.isCorrect === null).length;

    // Check appeal status
    const appeal = await this.prisma.scoreAppeal.findFirst({
      where: { examId, studentId },
      orderBy: { createdAt: 'desc' },
    });

    const base = {
      examTitle: session.exam.title,
      paperName: session.exam.paper.name,
      totalScore: session.totalScore,
      subjectiveScore: session.subjectiveScore,
      finalScore: session.finalScore,
      isPassed: session.isPassed,
      submittedAt: session.submittedAt,
      scoringStatus: session.scoringStatus,
      stats: { totalQuestions, correctCount, wrongCount, pendingCount },
      appealStatus: appeal?.status || null,
    };

    if (!showFull) {
      return {
        ...base,
        answers: [],
        message: '考后暂不展示试题详情，如需核查请联系管理员或提交申诉',
      };
    }

    return {
      ...base,
      answers: session.answers.map(a => {
        const pq = session.exam.paper.questions.find(q => q.id === a.paperQuestionId);
        const q = pq?.question;
        return {
          answerId: a.id, questionId: a.questionId, type: q?.type, content: q?.content,
          score: a.score, isCorrect: a.isCorrect, yourAnswer: a.answer,
          maxScore: pq?.score || 0, options: q?.options,
          correctAnswer: q ? this.getCorrectAnswer(q) : null, analysis: q?.analysis,
        };
      }),
    };
  }

  private getCorrectAnswer(question: any): any {
    switch (question.type) {
      case 'SINGLE_CHOICE': case 'TRUE_FALSE':
        return question.options?.find((o: any) => o.isCorrect)?.label || null;
      case 'MULTIPLE_CHOICE':
        return question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label) || [];
      case 'FILL_BLANK':
        return question.blanks?.map((b: any) => b.answer) || [];
      default: return null;
    }
  }

  async autoGrade(sessionId: number) {
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId },
      include: {
        session: {
          include: {
            exam: {
              include: {
                paper: {
                  include: {
                    questions: {
                      include: {
                        question: {
                          include: {
                            options: true,
                            blanks: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const paperQuestions = answers[0]?.session?.exam?.paper?.questions || [];
    const pqMap = new Map(paperQuestions.map((pq: any) => [pq.id, pq]));
    let totalScore = 0;

    for (const ans of answers) {
      const pq = pqMap.get(ans.paperQuestionId);
      if (!pq) continue;
      const question = pq.question;
      let isCorrect = false;
      let score = 0;

      switch (question.type) {
        case 'SINGLE_CHOICE': {
          const correct = question.options?.find((o: any) => o.isCorrect)?.label;
          isCorrect = String(ans.answer) === String(correct);
          score = isCorrect ? pq.score : 0;
          break;
        }
        case 'TRUE_FALSE': {
          const correct = question.options?.find((o: any) => o.isCorrect)?.label;
          isCorrect = String(ans.answer).toUpperCase() === String(correct).toUpperCase();
          score = isCorrect ? pq.score : 0;
          break;
        }
        case 'MULTIPLE_CHOICE': {
          const correct = question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).sort();
          // 学员多选答案可能是 "A,B,D" 字符串或 ["A","B","D"] 数组，统一转成数组再比较
          let studentAnswer = ans.answer;
          if (typeof studentAnswer === 'string') {
            studentAnswer = studentAnswer.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
          const student = (Array.isArray(studentAnswer) ? studentAnswer : []).sort();
          isCorrect = JSON.stringify(correct) === JSON.stringify(student);
          score = isCorrect ? pq.score : 0;
          break;
        }
        case 'FILL_BLANK': {
          const correctBlanks = question.blanks?.map((b: any) => b.answer.trim().toLowerCase()) || [];
          const studentAnswer = ans.answer as any;
          const studentBlanks = Array.isArray(studentAnswer)
            ? studentAnswer.map((a: any) => String(a).trim().toLowerCase())
            : [String(studentAnswer).trim().toLowerCase()];
          const perBlankScore = Math.floor(pq.score / Math.max(correctBlanks.length, 1));
          let blankScore = 0;
          for (let i = 0; i < correctBlanks.length; i++) {
            if (studentBlanks[i] === correctBlanks[i]) blankScore += perBlankScore;
          }
          isCorrect = blankScore === pq.score;
          score = blankScore;
          break;
        }
        default: continue;
      }

      await this.prisma.examAnswer.update({
        where: { id: ans.id },
        data: { isCorrect, score },
      });
      totalScore += score;
    }

    const examData = answers[0]?.session?.exam;
    const passingRef = examData?.passingScore ?? Math.floor((examData?.paper?.totalScore || 0) * 0.6);

    // 判断是否有主观题，决定 scoringStatus 和初始分数
    const hasSubjective = paperQuestions.some((pq: any) => SUBJECTIVE_TYPES.has(pq.question.type));
    const updateData: any = {
      totalScore,
      isPassed: totalScore >= passingRef,
      subjectiveScore: 0,
    };
    if (hasSubjective) {
      // 含主观题 → 等人工评分，finalScore 初始为 0 避免误导
      updateData.finalScore = 0;
    } else {
      // 纯客观题 → 直接 GRADED，finalScore = totalScore
      updateData.finalScore = totalScore;
      updateData.scoringStatus = 'GRADED';
      // AUTO 模式：纯客观题全部自动判分后直接发布
      if (examData?.scorePublishMode === 'AUTO') {
        updateData.scoringStatus = 'PUBLISHED';
        updateData.scoringPublishedAt = new Date();
      }
    }
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: updateData,
    });
  }

  private prepareExamQuestions(exam: any, session: any) {
    const markedQuestions: number[] = JSON.parse(session.markedQuestions || '[]');
    return {
      examId: exam.id,
      title: exam.title,
      timeMode: exam.timeMode || 'FIXED',
      durationMinutes: exam.durationMinutes,
      remainingTime: session.remainingTime ?? exam.durationMinutes * 60,
      sessionStatus: session.status,
      questions: exam.paper.questions.map((pq: any) => ({
        pqId: pq.id, questionId: pq.question.id, type: pq.question.type,
        content: pq.question.content, score: pq.score,
        options: pq.question.options.map((o: any) => ({
          id: o.id, questionId: o.questionId,
          label: o.label, content: o.content, sortOrder: o.sortOrder,
        })),
        blanks: pq.question.blanks.map((b: any) => ({
          id: b.id, questionId: b.questionId,
          blankIndex: b.blankIndex, sortOrder: b.sortOrder,
        })),
        subQuestions: pq.question.subQuestions,
        yourAnswer: session.answers?.find((a: any) => a.paperQuestionId === pq.id)?.answer || null,
        isMarked: markedQuestions.includes(pq.question.id),
      })),
    };
  }

  // ═══════════════════════════════════════════
  //  阅卷进度统计
  // ═══════════════════════════════════════════

  // ═══════════════════════════════════════════
  //  我的学习（学员端首页聚合）
  // ═══════════════════════════════════════════

  async getMyLearning(studentId: number) {
    // ── 考试统计 ──
    const examSessions = await this.prisma.examSession.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      include: {
        exam: {
          select: { id: true, title: true, passingScore: true, paper: { select: { id: true, name: true, totalScore: true } } },
        },
      },
    });

    const totalAttempts = examSessions.length;
    const submitted = examSessions.filter(s => s.status === 'SUBMITTED');
    const passed = submitted.filter(s => s.isPassed === true).length;
    const failed = submitted.filter(s => s.isPassed === false).length;
    const pendingScore = submitted.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === null).length;
    const scored = submitted.filter(s => s.finalScore != null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, s) => sum + (s.finalScore || 0), 0) / scored.length * 100) / 100
      : 0;

    const recentExams = examSessions.slice(0, 5).map(s => ({
      examId: s.exam.id,
      examTitle: s.exam.title,
      paperName: s.exam.paper?.name || '',
      totalScore: s.exam.paper?.totalScore || 0,
      myScore: s.finalScore,
      isPassed: s.isPassed,
      scoringStatus: s.scoringStatus,
      submittedAt: s.submittedAt,
    }));

    // ── 学时统计 ──
    const hourRecords = await this.prisma.learningHourRecord.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'desc' },
      include: {
        program: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, code: true } },
      },
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sumHours = (records: typeof hourRecords) => round2(records.reduce((s, r) => s + r.hours, 0));
    const totalHours = sumHours(hourRecords);
    const approvedHours = sumHours(hourRecords.filter(r => r.status === 'APPROVED'));
    const pendingHours = sumHours(hourRecords.filter(r => r.status === 'PENDING'));
    const rejectedHours = sumHours(hourRecords.filter(r => r.status === 'REJECTED'));

    const recentRecords = hourRecords.slice(0, 5).map(r => ({
      id: r.id,
      programName: r.program?.name || '—',
      source: r.source,
      hours: r.hours,
      typeName: r.type?.name || null,
      status: r.status,
      recordedAt: r.recordedAt,
    }));

    // ── 证书统计 ──
    const certs = await this.prisma.certificate.findMany({
      where: { studentId, isRevoked: false },
      orderBy: { issueDate: 'desc' },
      select: {
        id: true,
        certificateNo: true,
        courseName: true,
        issueDate: true,
      },
    });

    return {
      examStats: {
        totalAttempts,
        passed,
        failed,
        pendingScore,
        avgScore,
        recentExams,
      },
      hoursStats: {
        totalHours,
        approvedHours,
        pendingHours,
        rejectedHours,
        recentRecords,
      },
      certificates: {
        total: certs.length,
        items: certs,
      },
    };
  }

  async getGradingProgress(examId: number) {
    // 1. Session 级统计
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { id: true, scoringStatus: true },
    });
    const total = sessions.length;
    const graded = sessions.filter(s =>
      s.scoringStatus === 'GRADED' || s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED' || s.scoringStatus === 'ADJUSTED'
    ).length;
    const remaining = total - graded;
    const percentage = total > 0 ? Math.round(graded / total * 100) : 0;
    const sessionIds = sessions.map(s => s.id);

    // 2. 查出该场考试的主观题 PQ
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

    // 3. 查所有已评分的主观题 ExamAnswer（用于 perGrader 统计）
    const gradedSubjectiveAnswers = subjectivePQIds.length > 0 && sessionIds.length > 0
      ? await this.prisma.examAnswer.findMany({
          where: {
            sessionId: { in: sessionIds },
            paperQuestionId: { in: subjectivePQIds },
            score: { not: null },
          },
          select: { paperQuestionId: true },
        })
      : [];

    // 4. 查 GradingAssignment + 按 grader 分组
    const gradingAssignments = await this.prisma.gradingAssignment.findMany({
      where: { examId },
      include: { grader: { select: { id: true, displayName: true } } },
    });

    if (gradingAssignments.length === 0) {
      return { total, graded, remaining, percentage, perGrader: [] };
    }

    // 按 graderId 聚合分派信息
    const graderPQSet = new Map<number, { graderId: number; graderName: string; pqIds: Set<number | null> }>();
    for (const ga of gradingAssignments) {
      if (!graderPQSet.has(ga.graderId)) {
        graderPQSet.set(ga.graderId, { graderId: ga.graderId, graderName: ga.grader.displayName || '未知', pqIds: new Set() });
      }
      graderPQSet.get(ga.graderId)!.pqIds.add(ga.paperQuestionId);
    }

    const perGrader = [...graderPQSet.values()].map(g => {
      // 该阅卷员需评的主观题数 × 学员数 = assigned 总量
      const assigned = g.pqIds.has(null)
        ? total * subjectivePQIds.length
        : total * [...g.pqIds].filter(id => id !== null).length;

      // 该阅卷员实际已评的答案数
      const submitted = g.pqIds.has(null)
        ? gradedSubjectiveAnswers.length
        : gradedSubjectiveAnswers.filter(a => g.pqIds.has(a.paperQuestionId)).length;

      return {
        graderId: g.graderId,
        graderName: g.graderName,
        assigned: Math.max(assigned, submitted), // 避免负值
        submitted,
        remaining: Math.max(assigned - submitted, 0),
      };
    });

    return { total, graded, remaining, percentage, perGrader };
  }

  async getSessionStatusSummary(examId: number) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { scoringStatus: true },
    });
    const summary: Record<string, number> = { PENDING: 0, GRADING: 0, GRADED: 0, PUBLISHED: 0, CONFIRMED: 0, ADJUSTED: 0 };
    for (const s of sessions) {
      const key = s.scoringStatus || 'PENDING';
      summary[key] = (summary[key] || 0) + 1;
    }
    return summary;
  }

  async getTranscript(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        paper: { select: { id: true, name: true, totalScore: true } },
        sessions: {
          where: { status: 'SUBMITTED' },
          include: { student: { select: { id: true, displayName: true, username: true, organization: true } } },
          orderBy: { totalScore: 'desc' },
        },
      },
    });
    if (!exam) throw new NotFoundException('考试不存在');
    return {
      examTitle: exam.title,
      paperName: exam.paper.name,
      totalScore: exam.paper.totalScore,
      rows: exam.sessions.map(s => ({
        sessionId: s.id,
        studentId: s.studentId,
        studentName: s.student.displayName,
        username: s.student.username,
        organization: s.student.organization,
        totalScore: s.totalScore,
        finalScore: s.finalScore,
        isPassed: s.isPassed,
        scoringStatus: s.scoringStatus,
        submittedAt: s.submittedAt,
      })),
    };
  }
  async getExamResults(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, paper: { select: { name: true } } },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: { student: { select: { id: true, displayName: true } } },
    });

    const appeals = await this.prisma.scoreAppeal.findMany({
      where: { examId },
      select: { studentId: true, status: true },
    });
    const appealMap = new Map(appeals.map(a => [a.studentId, a.status]));

    return {
      examId: exam.id,
      examTitle: exam.title,
      paperName: exam.paper?.name,
      students: sessions.map(s => ({
        studentId: s.student.id,
        studentName: s.student.displayName,
        totalScore: s.totalScore,
        finalScore: s.finalScore,
        isPassed: s.isPassed,
        submittedAt: s.submittedAt,
        scoringStatus: s.scoringStatus,
        appealStatus: appealMap.get(s.student.id) || null,
      })),
    };
  }

  async submitAppeal(examId: number, studentId: number, reason: string) {
    const existing = await this.prisma.scoreAppeal.findFirst({
      where: { examId, studentId, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('已有待处理的申诉，请等待管理员处理');
        const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    return this.prisma.scoreAppeal.create({
      data: { examId, sessionId: session.id, studentId, reason, description: reason },
    });
  }

  async getAppeals(examId: number) {
    return this.prisma.scoreAppeal.findMany({
      where: { examId },
      include: { student: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveAppeal(appealId: number, data: { status: string; adminNote?: string; newScore?: number }) {
    const updateData: any = { status: data.status, adminNote: data.adminNote, resolvedAt: new Date() };
    if (data.status === 'APPROVED' && data.newScore !== undefined) {
      const appeal = await this.prisma.scoreAppeal.findUnique({ where: { id: appealId } });
      if (!appeal) throw new NotFoundException('申诉记录不存在');
      await this.prisma.examSession.update({
        where: { examId_studentId: { examId: appeal.examId, studentId: appeal.studentId } },
        data: { finalScore: data.newScore },
      });
      updateData.newScore = data.newScore;
    }
    return this.prisma.scoreAppeal.update({ where: { id: appealId }, data: updateData });
  }

  async publishScores(examId: number) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { id: true, title: true } });
    if (!exam) throw new NotFoundException('考试不存在');
    const result = await this.prisma.examSession.updateMany({
      where: { examId, scoringStatus: { notIn: ['PUBLISHED', 'ADJUSTED'] } },
      data: { scoringStatus: 'PUBLISHED', scoringPublishedAt: new Date() },
    });

    // 成绩发布后通知学员
    const submittedSessions = await this.prisma.examSession.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { studentId: true },
    });
    const gradedStudentIds = [...new Set(submittedSessions.map(s => s.studentId))];
    if (gradedStudentIds.length > 0) {
      void this.notificationService.createMany(
        gradedStudentIds,
        'EXAM_GRADED' as any,
        `成绩已发布「${exam.title}」`,
        `考试成绩已发布，请查看你的成绩`,
        examId, 'exam',
      );
    }

    return { ok: true, publishedCount: result.count, message: `已发布 ${result.count} 份成绩` };
  }

  async markQuestion(examId: number, studentId: number, questionId: number) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session || session.status === 'SUBMITTED') throw new NotFoundException('考试不存在或已结束');

    const current: number[] = JSON.parse(session.markedQuestions || '[]');
    if (!current.includes(questionId)) {
      current.push(questionId);
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { markedQuestions: JSON.stringify(current) },
      });
    }
    return { markedQuestions: current };
  }

  async unmarkQuestion(examId: number, studentId: number, questionId: number) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session || session.status === 'SUBMITTED') throw new NotFoundException('考试不存在或已结束');

    const current: number[] = JSON.parse(session.markedQuestions || '[]');
    const updated = current.filter(id => id !== questionId);
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: { markedQuestions: JSON.stringify(updated) },
    });
    return { markedQuestions: updated };
  }
}