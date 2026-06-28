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

    // Group by student
    const studentMap = new Map<number, { student: any; hours: number; videos: number }>();
    for (const r of records) {
      const existing = studentMap.get(r.studentId);
      if (existing) {
        existing.hours += r.hours;
        if (r.source === 'VIDEO') existing.videos += 1;
      } else {
        studentMap.set(r.studentId, {
          student: r.student,
          hours: r.hours,
          videos: r.source === 'VIDEO' ? 1 : 0,
        });
      }
    }

    return Array.from(studentMap.values()).map(s => ({
      studentId: s.student.id,
      displayName: s.student.displayName,
      studentNumber: s.student.studentNumber,
      hours: Math.round(s.hours * 100) / 100,
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
}
