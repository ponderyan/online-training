import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════
  //  场次管理（教务端）
  // ═══════════════════════════════════════════

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; paperId?: number; programId?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.title = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.paperId) where.paperId = params.paperId;
    if (params.programId) where.programId = params.programId;

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

  async findOne(id: number) {
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
    return exam;
  }

  async create(data: {
    title: string; paperId: number; createdBy: number;
    startTime: string; endTime: string; durationMinutes: number;
    accessType?: string; shuffleQuestions?: boolean; shuffleOptions?: boolean;
    password?: string;
    programId?: number; passingScore?: number;
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

  async update(id: number, data: any) {
    const exam = await this.findOne(id);
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

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.exam.delete({ where: { id } });
  }

  async publish(id: number) {
    const exam = await this.findOne(id);
    if (exam.status !== 'DRAFT') throw new BadRequestException('只能发布草稿状态的考试');
    return this.prisma.exam.update({ where: { id }, data: { status: 'PUBLISHED' } });
  }

  async finish(id: number) {
    const exam = await this.findOne(id);
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
      paperName: s.exam.paper.name,
      totalScore: s.exam.paper.totalScore,
      durationMinutes: s.exam.paper.durationMinutes,
      startTime: s.exam.startTime,
      endTime: s.exam.endTime,
      accessType: s.exam.accessType,
      sessionStatus: s.status,
      remainingTime: s.remainingTime,
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

  async getResult(examId: number, studentId: number) {
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
    return {
      examTitle: session.exam.title,
      paperName: session.exam.paper.name,
      totalScore: session.totalScore,
      subjectiveScore: session.subjectiveScore,
      finalScore: session.finalScore,
      isPassed: session.isPassed,
      submittedAt: session.submittedAt,
      scoringStatus: session.scoringStatus,
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
    return {
      examId: exam.id,
      title: exam.title,
      durationMinutes: exam.durationMinutes,
      remainingTime: session.remainingTime || exam.durationMinutes * 60,
      sessionStatus: session.status,
      questions: exam.paper.questions.map((pq: any) => ({
        pqId: pq.id, questionId: pq.question.id, type: pq.question.type,
        content: pq.question.content, score: pq.score,
        options: pq.question.options, blanks: pq.question.blanks,
        subQuestions: pq.question.subQuestions,
        yourAnswer: session.answers?.find((a: any) => a.paperQuestionId === pq.id)?.answer || null,
      })),
    };
  }

  // ═══════════════════════════════════════════
  //  阅卷进度统计
  // ═══════════════════════════════════════════

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
}
