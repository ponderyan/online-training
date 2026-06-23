import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CourseVideosService {
  constructor(private prisma: PrismaService) {}

  async findAll(courseId: number) {
    return this.prisma.courseVideo.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: number) {
    const video = await this.prisma.courseVideo.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('视频不存在');
    return video;
  }

  async create(courseId: number, dto: { title: string; url: string; duration?: number; requiredPct?: number; sortOrder?: number; isPublic?: boolean }) {
    const maxSort = await this.prisma.courseVideo.aggregate({
      where: { courseId },
      _max: { sortOrder: true },
    });
    return this.prisma.courseVideo.create({
      data: {
        courseId,
        title: dto.title,
        url: dto.url,
        duration: dto.duration || 0,
        requiredPct: dto.requiredPct || 80,
        sortOrder: dto.sortOrder ?? ((maxSort._max.sortOrder ?? 0) + 1),
        isPublic: dto.isPublic || false,
      },
    });
  }

  async update(id: number, dto: { title?: string; url?: string; duration?: number; requiredPct?: number; sortOrder?: number; isPublic?: boolean }) {
    const video = await this.findOne(id);
    return this.prisma.courseVideo.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    await this.findOne(id);
    return this.prisma.courseVideo.delete({ where: { id } });
  }

  async reorder(courseId: number, videoIds: number[]) {
    await Promise.all(
      videoIds.map((id, index) =>
        this.prisma.courseVideo.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  // 进度相关
  async getProgress(videoId: number, studentId: number) {
    return this.prisma.videoProgress.findUnique({
      where: { videoId_studentId: { videoId, studentId } },
    });
  }

  async reportProgress(videoId: number, studentId: number, dto: { progress: number; lastPosition: number; completed?: boolean }) {
    const { progress, lastPosition, completed } = dto;

    // Check existing to detect first-time completion
    const existing = await this.prisma.videoProgress.findUnique({
      where: { videoId_studentId: { videoId, studentId } },
    });

    const record = await this.prisma.videoProgress.upsert({
      where: { videoId_studentId: { videoId, studentId } },
      create: { videoId, studentId, progress, lastPosition, completed: completed || false, completedAt: completed ? new Date() : null },
      update: { progress, lastPosition, ...(completed ? { completed: true, completedAt: new Date() } : {}) },
    });

    // Auto-record learning hours on first completion
    if (completed && (!existing || !existing.completed)) {
      await this.recordLearningHours(videoId, studentId);
    }

    return record;
  }

  private async recordLearningHours(videoId: number, studentId: number) {
    const video = await this.prisma.courseVideo.findUnique({
      where: { id: videoId },
      include: {
        course: {
          include: { programs: { select: { id: true } } },
        },
      },
    });
    if (!video) return;

    const hours = Math.round(((video.duration / 3600) * (video.requiredPct / 100)) * 100) / 100;
    if (hours <= 0) return;

    // Deduplicate
    const existing = await this.prisma.learningHourRecord.findFirst({
      where: { studentId, source: 'VIDEO', sourceId: videoId },
    });
    if (existing) return;

    const programs = video.course?.programs || [];
    if (programs.length === 0) {
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
