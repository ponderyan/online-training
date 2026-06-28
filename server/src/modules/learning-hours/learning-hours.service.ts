import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LearningHoursService {
  constructor(private prisma: PrismaService) {}

  async findAll(studentId: number, params?: { programId?: number; source?: string }) {
    const where: any = { studentId };
    if (params?.programId) where.programId = params.programId;
    if (params?.source) where.source = params.source;

    const [items, total] = await Promise.all([
      this.prisma.learningHourRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        include: { program: { select: { id: true, name: true } } },
      }),
      this.prisma.learningHourRecord.count({ where }),
    ]);

    // 为 VIDEO 来源的记录补充视频名称
    const enriched = await Promise.all(items.map(async (r) => {
      let videoName: string | null = null;
      if (r.source === 'VIDEO' && r.sourceId) {
        const vc = await this.prisma.videoCourse.findUnique({
          where: { id: r.sourceId },
          select: { name: true },
        });
        if (vc) videoName = vc.name;
      }
      return { ...r, videoName };
    }));

    return { items: enriched, total };
  }

  async stats(studentId: number) {
    const records = await this.prisma.learningHourRecord.findMany({
      where: { studentId },
      include: { program: { select: { id: true, name: true } } },
    });

    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const completedVideos = records.filter(r => r.source === 'VIDEO').length;

    // Group by program
    const programMap = new Map<number, { programId: number; programName: string; hours: number }>();
    for (const r of records) {
      if (!r.programId) continue;
      const existing = programMap.get(r.programId);
      if (existing) {
        existing.hours += r.hours;
      } else {
        programMap.set(r.programId, {
          programId: r.programId,
          programName: r.program?.name || '未知',
          hours: r.hours,
        });
      }
    }

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      completedVideos,
      programStats: Array.from(programMap.values()),
    };
  }

  async programStats(programId: number) {
    const records = await this.prisma.learningHourRecord.findMany({
      where: { programId },
      include: { student: { select: { id: true, displayName: true, studentNumber: true } } },
    });

    const studentMap = new Map<number, {
      student: any;
      totalHours: number;
      videoHours: number;
      offlineHours: number;
      pendingHours: number;
      approvedHours: number;
      rejectedHours: number;
      videos: number;
    }>();

    for (const r of records) {
      let entry = studentMap.get(r.studentId);
      if (!entry) {
        entry = {
          student: r.student,
          totalHours: 0, videoHours: 0, offlineHours: 0,
          pendingHours: 0, approvedHours: 0, rejectedHours: 0, videos: 0,
        };
        studentMap.set(r.studentId, entry);
      }
      entry.totalHours += r.hours;
      if (r.source === 'VIDEO') { entry.videoHours += r.hours; entry.videos += 1; }
      else { entry.offlineHours += r.hours; }
      if (r.status === 'PENDING') entry.pendingHours += r.hours;
      else if (r.status === 'APPROVED') entry.approvedHours += r.hours;
      else if (r.status === 'REJECTED') entry.rejectedHours += r.hours;
    }

    return Array.from(studentMap.values()).map(s => ({
      studentId: s.student.id,
      displayName: s.student.displayName,
      studentNumber: s.student.studentNumber,
      totalHours: Math.round(s.totalHours * 100) / 100,
      videoHours: Math.round(s.videoHours * 100) / 100,
      offlineHours: Math.round(s.offlineHours * 100) / 100,
      pendingHours: Math.round(s.pendingHours * 100) / 100,
      approvedHours: Math.round(s.approvedHours * 100) / 100,
      rejectedHours: Math.round(s.rejectedHours * 100) / 100,
      videos: s.videos,
    }));
  }

  // Auto-record when video is completed
  async recordVideoCompletion(videoId: number, studentId: number) {
    const video = await this.prisma.courseVideo.findUnique({
      where: { id: videoId },
      include: {
        course: {
          include: { programs: { select: { id: true } } },
        },
      },
    });
    if (!video) return;

    // Calculate hours: (duration / 3600) * (requiredPct / 100)
    const hours = Math.round(((video.duration / 3600) * (video.requiredPct / 100)) * 100) / 100;
    if (hours <= 0) return;

    // Deduplicate: same videoId + studentId only once
    const existing = await this.prisma.learningHourRecord.findFirst({
      where: { studentId, source: 'VIDEO', sourceId: videoId },
    });
    if (existing) return;

    // Create record for each linked program
    const programs = video.course?.programs || [];
    if (programs.length === 0) {
      // Still record even without program linkage
      await this.prisma.learningHourRecord.create({
        data: { studentId, source: 'VIDEO', sourceId: videoId, hours, programId: null },
      });
    } else {
      for (const program of programs) {
        await this.prisma.learningHourRecord.create({
          data: { studentId, source: 'VIDEO', sourceId: videoId, hours, programId: program.id },
        });
      }
    }
  }

  async getPendingHours(programId?: number) {
    const where: any = { status: 'PENDING' };
    if (programId) where.programId = programId;
    return this.prisma.learningHourRecord.findMany({
      where,
      include: {
        student: { select: { id: true, displayName: true, studentNumber: true, organization: true } },
        program: { select: { id: true, name: true, hoursPerDay: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async approveHours(ids: number[], reviewerId: number, comment?: string) {
    return this.prisma.learningHourRecord.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'APPROVED', approvedById: reviewerId, approvedAt: new Date(), reviewComment: comment || null },
    });
  }

  async rejectHours(ids: number[], reviewerId: number, comment: string) {
    return this.prisma.learningHourRecord.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'REJECTED', approvedById: reviewerId, approvedAt: new Date(), reviewComment: comment },
    });
  }
}