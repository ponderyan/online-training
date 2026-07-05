import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private systemConfig: SystemConfigService,
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
    orgId?: number | null;
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
    return this.prisma.exam.update({ where: { id }, data: updateData });
  }

  async remove(id: number, userOrgId?: number | null, userRoles?: string[]) {
    await this.findOne(id, userOrgId, userRoles);
    return this.prisma.exam.delete({ where: { id } });
  }

  async publish(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(id, userOrgId, userRoles);
    if (exam.status !== 'DRAFT') throw new BadRequestException('只能发布草稿状态的考试');
    return this.prisma.exam.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async finish(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const exam = await this.findOne(id, userOrgId, userRoles);
    if (exam.status === 'FINISHED') throw new BadRequestException('考试已结束');
    await this.prisma.examSession.updateMany({
      where: { examId: id, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    return this.prisma.exam.update({ where: { id }, data: { status: 'FINISHED' } });
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

  async startExam(examId: number, studentId: number) {
    const exam = await this.findOne(examId);
    if (exam.status !== 'PUBLISHED' && exam.status !== 'IN_PROGRESS') throw new BadRequestException('考试未开放');

    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { answers: true },
    });
    if (!session) throw new ForbiddenException('你没有被分配该考试');
    if (session.status === 'SUBMITTED') throw new BadRequestException('你已提交答卷');

    if (session.status === 'ACTIVE' || session.status === 'PAUSED') {
      return this.prepareExamQuestions(exam, session);
    }

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: { status: 'ACTIVE', startedAt: new Date(), remainingTime: exam.durationMinutes * 60 },
    });
    return this.prepareExamQuestions(exam, { ...session, status: 'ACTIVE' });
  }

  async submitExam(examId: number, studentId: number, answers: { questionId: number; paperQuestionId: number; answer: any }[], tabSwitchLog?: any[]) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { answers: true, exam: true },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.status === 'SUBMITTED') throw new BadRequestException('已提交，不可重复提交');
    if (session.exam.endTime && new Date() > new Date(session.exam.endTime)) throw new BadRequestException('考试已结束，无法提交');

    for (const ans of answers) {
      await this.prisma.examAnswer.upsert({
        where: { sessionId_paperQuestionId: { sessionId: session.id, paperQuestionId: ans.paperQuestionId } },
        create: { sessionId: session.id, questionId: ans.questionId, paperQuestionId: ans.paperQuestionId, answer: ans.answer },
        update: { answer: ans.answer },
      });
    }

    await this.autoGrade(session.id);

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: 'SUBMITTED', submittedAt: new Date(), scoringStatus: 'PENDING',
        violationLog: tabSwitchLog ? tabSwitchLog as any : undefined,
      },
    });

    await this.prisma.exam.update({
      where: { id: examId },
      data: { submittedCount: { increment: 1 } },
    });
    return { success: true };
  }

  async heartbeat(examId: number, studentId: number, tabSwitchData?: any[]) {
    const session = await this.prisma.examSession.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!session || session.status !== 'ACTIVE') return { ok: false };

    const updateData: any = {
      lastHeartbeatAt: new Date(),
    };

    // 递减剩余时间
    if (session.remainingTime && session.remainingTime > 0) {
      updateData.remainingTime = session.remainingTime - 30;
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
    return { ok: true, remainingTime: updateData.remainingTime };
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
      const published = session.scoringStatus === 'PUBLISHED' || session.scoringStatus === 'ADJUSTED';
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
          const student = (Array.isArray(ans.answer) ? ans.answer : []).sort();
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
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { totalScore, finalScore: totalScore, isPassed: totalScore >= passingRef },
    });
  }

  private prepareExamQuestions(exam: any, session: any) {
    const markedQuestions: number[] = JSON.parse(session.markedQuestions || '[]');
    return {
      examId: exam.id,
      title: exam.title,
      durationMinutes: exam.durationMinutes,
      remainingTime: session.remainingTime || exam.durationMinutes * 60,
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

    // Per grader stats
    const gradingAssignments = await this.prisma.gradingAssignment.findMany({
      where: { examId },
      include: { grader: { select: { id: true, displayName: true } } },
    });
    const graderMap = new Map<number, { graderId: number; graderName: string; assigned: number; submitted: number; remaining: number }>();
    for (const ga of gradingAssignments) {
      if (!graderMap.has(ga.graderId)) {
        graderMap.set(ga.graderId, { graderId: ga.graderId, graderName: ga.grader.displayName || '未知', assigned: 0, submitted: 0, remaining: 0 });
      }
      graderMap.get(ga.graderId)!.assigned++;
      if (ga.status === 'SUBMITTED' || ga.status === 'COMPLETED') {
        graderMap.get(ga.graderId)!.submitted++;
      }
    }
    for (const g of graderMap.values()) {
      g.remaining = g.assigned - g.submitted;
    }

    return { total, graded, remaining, percentage, perGrader: [...graderMap.values()] };
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