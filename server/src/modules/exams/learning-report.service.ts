import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const LEVEL_THRESHOLDS = [
  { min: 90, label: '优秀' },
  { min: 75, label: '良好' },
  { min: 60, label: '一般' },
  { min: 40, label: '薄弱' },
] as const;

function getLevel(rate: number): string {
  for (const t of LEVEL_THRESHOLDS) {
    if (rate >= t.min) return t.label;
  }
  return '危险';
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

@Injectable()
export class LearningReportService {
  constructor(private prisma: PrismaService) {}

  async getReport(studentId: number) {
    // Run independent sections in parallel
    const [summary, examTrend, hoursDistribution, learningActivity, programProgress] = await Promise.all([
      this.getSummary(studentId).catch(() => ({
        passRate: 0, passed: 0, failed: 0, pending: 0,
        totalHours: 0, approvedHours: 0, pendingHours: 0, rejectedHours: 0,
        certificateCount: 0, avgScore: 0,
      })),
      this.getExamTrend(studentId).catch(() => []),
      this.getHoursDistribution(studentId).catch(() => []),
      this.getLearningActivity(studentId).catch(() => ({
        dailyActivity: [],
        totalActiveDays: 0,
        currentStreak: 0,
      })),
      this.getProgramProgress(studentId).catch(() => []),
    ]);

    // Knowledge mastery might be heavy, run after lightweight sections
    const kpMastery = await this.getKnowledgeMastery(studentId).catch(() => []);

    // Derive weak areas from knowledge mastery
    const weakAreas = kpMastery.length > 0
      ? kpMastery
          .slice()
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 5)
          .map(kp => ({
            kpId: kp.kpId,
            kpName: kp.kpName,
            rate: kp.rate,
            level: kp.level,
          }))
      : [];

    const lastActiveDate = learningActivity.dailyActivity.length > 0
      ? learningActivity.dailyActivity
          .filter(d => d.isActive)
          .slice(-1)[0]?.date || null
      : null;

    return {
      summary,
      examTrend,
      kpMastery,
      hoursDistribution,
      weakAreas,
      streak: {
        totalActiveDays: learningActivity.totalActiveDays,
        currentStreak: learningActivity.currentStreak,
        lastActiveDate,
      },
      dailyActivity: learningActivity.dailyActivity,
      recent30DayActive: learningActivity.totalActiveDays,
      programProgress,
    };
  }

  // ──────────────────────────────
  //  Summary
  // ──────────────────────────────

  private async getSummary(studentId: number) {
    const [examSessions, hourRecords, certCount, pendingCount] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { studentId, submittedAt: { not: null } },
        select: { isPassed: true, finalScore: true },
      }),
      this.prisma.learningHourRecord.findMany({
        where: { studentId },
        select: { hours: true, status: true },
      }),
      this.prisma.certificate.count({
        where: { studentId, isRevoked: false },
      }),
      this.prisma.examSession.count({
        where: { studentId, status: 'SUBMITTED', finalScore: null },
      }),
    ]);

    const totalAttempts = examSessions.length;
    const passed = examSessions.filter(s => s.isPassed === true).length;
    const failed = examSessions.filter(s => s.isPassed === false).length;
    const scores = examSessions
      .filter(s => s.finalScore !== null)
      .map(s => s.finalScore!);
    const avgScore = scores.length > 0
      ? round2(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const totalHours = hourRecords.reduce((s, r) => s + r.hours, 0);
    const approvedHours = hourRecords
      .filter(r => r.status === 'APPROVED')
      .reduce((s, r) => s + r.hours, 0);
    const pendingHours = hourRecords
      .filter(r => r.status === 'PENDING')
      .reduce((s, r) => s + r.hours, 0);
    const rejectedHours = hourRecords
      .filter(r => r.status === 'REJECTED')
      .reduce((s, r) => s + r.hours, 0);

    return {
      passRate: pct(passed, totalAttempts),
      passed,
      failed,
      pending: pendingCount,
      totalHours: round2(totalHours),
      approvedHours: round2(approvedHours),
      pendingHours: round2(pendingHours),
      rejectedHours: round2(rejectedHours),
      certificateCount: certCount,
      avgScore,
    };
  }

  // ──────────────────────────────
  //  Exam Trend
  // ──────────────────────────────

  private async getExamTrend(studentId: number) {
    const sessions = await this.prisma.examSession.findMany({
      where: { studentId, status: 'SUBMITTED', finalScore: { not: null } },
      include: {
        exam: {
          include: {
            paper: { select: { totalScore: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    return sessions.map(s => ({
      examId: s.exam.id,
      examTitle: s.exam.title,
      totalScore: s.exam.paper.totalScore,
      myScore: s.finalScore,
      scoreRate:
        s.finalScore !== null && s.exam.paper.totalScore > 0
          ? round2((s.finalScore / s.exam.paper.totalScore) * 100)
          : null,
      isPassed: s.isPassed,
      submittedAt: s.submittedAt?.toISOString() || '',
    }));
  }

  // ──────────────────────────────
  //  Knowledge Mastery
  // ──────────────────────────────

  private async getKnowledgeMastery(studentId: number) {
    const answers = await this.prisma.examAnswer.findMany({
      where: {
        session: { studentId },
        isCorrect: { not: null },
      },
      select: {
        questionId: true,
        isCorrect: true,
        sessionId: true,
      },
    });

    if (answers.length === 0) return [];

    const questionIds = [...new Set(answers.map(a => a.questionId))];

    const qkps = await this.prisma.questionKnowledgePoint.findMany({
      where: { questionId: { in: questionIds } },
      include: {
        knowledgePoint: {
          select: { id: true, name: true },
        },
      },
    });

    if (qkps.length === 0) return [];

    // questionId -> KPs mapping
    const questionKps = new Map<number, typeof qkps>();
    for (const qkp of qkps) {
      if (!questionKps.has(qkp.questionId)) {
        questionKps.set(qkp.questionId, []);
      }
      questionKps.get(qkp.questionId)!.push(qkp);
    }

    // KP aggregated stats
    const kpMap = new Map<
      number,
      { total: number; correct: number; name: string; sessions: Set<number> }
    >();

    for (const qkp of qkps) {
      if (!kpMap.has(qkp.knowledgePointId)) {
        kpMap.set(qkp.knowledgePointId, {
          total: 0,
          correct: 0,
          name: qkp.knowledgePoint.name,
          sessions: new Set(),
        });
      }
    }

    // A question may map to multiple KPs — count each KP separately
    for (const answer of answers) {
      const kps = questionKps.get(answer.questionId) || [];
      for (const kp of kps) {
        const entry = kpMap.get(kp.knowledgePointId);
        if (entry) {
          entry.total++;
          if (answer.isCorrect === true) {
            entry.correct++;
          }
          entry.sessions.add(answer.sessionId);
        }
      }
    }

    return Array.from(kpMap.entries())
      .filter(([, data]) => data.total > 0)
      .map(([kpId, data]) => {
        const rate = pct(data.correct, data.total);
        return {
          kpId,
          kpName: data.name,
          rate,
          level: getLevel(rate),
          examCount: data.sessions.size,
          correctRate: rate,
        };
      });
  }

  // ──────────────────────────────
  //  Hours Distribution
  // ──────────────────────────────

  private async getHoursDistribution(studentId: number) {
    const records = await this.prisma.learningHourRecord.findMany({
      where: { studentId, status: 'APPROVED' },
      include: {
        type: { select: { id: true, name: true, code: true } },
      },
    });

    const totalHours = records.reduce((s, r) => s + r.hours, 0);
    const typeMap = new Map<string, { name: string; code: string; hours: number }>();

    for (const r of records) {
      const typeId = r.typeId ? String(r.typeId) : 'OTHER';
      if (!typeMap.has(typeId)) {
        typeMap.set(typeId, {
          name: r.type?.name || '未分类',
          code: r.type?.code || 'OTHER',
          hours: 0,
        });
      }
      typeMap.get(typeId)!.hours += r.hours;
    }

    return Array.from(typeMap.entries()).map(([, data]) => ({
      typeName: data.name,
      typeCode: data.code,
      hours: round2(data.hours),
      percentage: pct(data.hours, totalHours),
    }));
  }

  // ──────────────────────────────
  //  Learning Activity (last 30 days)
  // ──────────────────────────────

  private async getLearningActivity(studentId: number) {
    const from = new Date();
    from.setDate(from.getDate() - 30);

    const [examSessions, hourRecords, practiceRecords, videoProgresses] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { studentId, submittedAt: { not: null, gte: from } },
        select: { submittedAt: true },
      }),
      this.prisma.learningHourRecord.findMany({
        where: { studentId, recordedAt: { gte: from } },
        select: { recordedAt: true, hours: true },
      }),
      this.prisma.practiceRecord.findMany({
        where: { studentId, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.videoProgress.findMany({
        where: { studentId, updatedAt: { gte: from }, completed: true },
        select: { updatedAt: true },
      }),
    ]);

    // Init all 30 days
    const dailyMap = new Map<
      string,
      { examCount: number; studyHours: number; videoHours: number; practiceCount: number }
    >();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), {
        examCount: 0,
        studyHours: 0,
        videoHours: 0,
        practiceCount: 0,
      });
    }

    for (const s of examSessions) {
      const key = s.submittedAt!.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) entry.examCount++;
    }
    for (const r of hourRecords) {
      const key = r.recordedAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) entry.studyHours += r.hours;
    }
    for (const p of practiceRecords) {
      const key = p.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) entry.practiceCount++;
    }
    for (const v of videoProgresses) {
      const key = v.updatedAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) entry.videoHours++;
    }

    const dailyActivity = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      examCount: data.examCount,
      studyHours: data.studyHours,
      videoHours: data.videoHours,
      practiceCount: data.practiceCount,
      isActive: data.examCount > 0 || data.studyHours > 0 || data.videoHours > 0 || data.practiceCount > 0,
    }));

    const totalActiveDays = dailyActivity.filter(d => d.isActive).length;

    // Current streak: consecutive active days backwards from today
    let currentStreak = 0;
    for (const day of dailyActivity) {
      if (day.isActive) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { dailyActivity, totalActiveDays, currentStreak };
  }

  // ──────────────────────────────
  //  Program Progress
  // ──────────────────────────────

  private async getProgramProgress(studentId: number) {
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { studentId },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            exams: { select: { id: true } },
          },
        },
      },
    });

    if (enrollments.length === 0) return [];

    const results = await Promise.all(
      enrollments.map(async enrollment => {
        const program = enrollment.program;
        const examIds = program.exams.map(e => e.id);
        const totalCourses = examIds.length;

        let completedCourses = 0;
        if (examIds.length > 0) {
          completedCourses = await this.prisma.examSession.count({
            where: {
              studentId,
              examId: { in: examIds },
              status: 'SUBMITTED',
              finalScore: { not: null },
            },
          });
        }

        return {
          programId: program.id,
          programName: program.name,
          progressRate: pct(completedCourses, totalCourses),
          totalCourses,
          completedCourses: Math.min(completedCourses, totalCourses),
        };
      }),
    );

    return results;
  }
}
