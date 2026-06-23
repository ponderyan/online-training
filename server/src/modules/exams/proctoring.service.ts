import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExamsService } from './exams.service.js';

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
      select: { id: true, status: true, lastHeartbeatAt: true, suspicionLevel: true },
    });

    const now = new Date();
    let onlineCount = 0, offlineCount = 0, submittedCount = 0, abnormalCount = 0;

    for (const s of sessions) {
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

    return { totalStudents, onlineCount, offlineCount, submittedCount, abnormalCount };
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

  async warn(examId: number, sessionId: number, message: string, operatorName: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('考试记录不存在');

    const action = { timestamp: new Date().toISOString(), action: 'WARN', message, operatorName };
    const existingActions = Array.isArray(session.proctorActions) ? session.proctorActions : [];

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { proctorActions: [...existingActions, action] },
    });
    return { success: true };
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

    // Increment exam submittedCount
    await this.prisma.exam.update({
      where: { id: examId },
      data: { submittedCount: { increment: 1 } },
    });

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

    return { success: true, newRemainingTime };
  }
}
