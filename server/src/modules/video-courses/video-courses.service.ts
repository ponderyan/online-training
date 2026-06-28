import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class VideoCoursesService {
  constructor(private prisma: PrismaService) {}

  async canAccessVideo(videoId: number, userId: number, roles: string[]): Promise<boolean> {
    // 管理员/讲师 放行
    if (roles?.some(r => ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER'].includes(r))) return true;

    // PUBLIC 类型视频放行（即使未登录也放行）
    const video = await this.prisma.videoCourse.findUnique({ where: { id: videoId } });
    if (!video) return false;
    if (video.type === 'PUBLIC') return true;

    // 未登录用户只能看 PUBLIC，以下需要 userId
    if (!userId) return false;

    // SPECIALIZED 类型：检查学员是否报了关联课程的培训班
    const courseIds = await this.prisma.videoCourseCourse.findMany({
      where: { videoCourseId: videoId },
      select: { courseId: true },
    });
    if (courseIds.length === 0) return false;

    const enrolledPrograms = await this.prisma.programEnrollment.findMany({
      where: { studentId: userId },
      select: { programId: true },
    });
    const programIds = enrolledPrograms.map(e => e.programId);

    const matchingSchedules = await this.prisma.schedule.findMany({
      where: {
        programId: { in: programIds },
        courseId: { in: courseIds.map(c => c.courseId) },
      },
      take: 1,
    });

    return matchingSchedules.length > 0;
  }

  async findAll(params: { page?: number; pageSize?: number; type?: string; keyword?: string; status?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.keyword) where.name = { contains: params.keyword };

    const [items, total] = await Promise.all([
      this.prisma.videoCourse.findMany({
        where,
        include: {
          courseLinks: { include: { course: { select: { id: true, name: true, type: true, code: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.videoCourse.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const video = await this.prisma.videoCourse.findUnique({
      where: { id },
      include: {
        courseLinks: { include: { course: { select: { id: true, name: true, type: true, code: true } } } },
        logs: {
          include: { operator: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!video) throw new NotFoundException('视频课程不存在');
    return video;
  }

  async create(data: any, userId: number) {
    const { courseIds, ...rest } = data;
    // 公开课默认已发布，专项课默认草稿
    if (rest.type === 'PUBLIC' && !rest.status) rest.status = 'PUBLISHED';
    if (rest.type === 'SPECIALIZED' && !rest.status) rest.status = 'DRAFT';
    // Build clean data: include all fields but drop null values for nullable fields
    // so Prisma uses defaults for non-nullable fields with defaults
    const cleanData: any = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null) cleanData[key] = value;
    }
    const video = await this.prisma.videoCourse.create({
      data: {
        ...cleanData,
        courseLinks: courseIds?.length
          ? { create: courseIds.map((courseId: number) => ({ courseId })) }
          : undefined,
      },
      include: {
        courseLinks: { include: { course: { select: { id: true, name: true } } } },
      },
    });

    await this.prisma.videoCourseLog.create({
      data: { videoCourseId: video.id, action: '创建视频课程', operatorId: userId },
    });

    return video;
  }

  async update(id: number, data: any, userId: number) {
    const video = await this.findOne(id);
    const { courseIds, ...rest } = data;
    // Drop null/undefined values to avoid Prisma validation issues
    const cleanData: any = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null) cleanData[key] = value;
    }

    const updated = await this.prisma.videoCourse.update({
      where: { id },
      data: {
        ...cleanData,
        courseLinks: courseIds !== undefined
          ? {
              deleteMany: {},
              create: courseIds.map((courseId: number) => ({ courseId })),
            }
          : undefined,
      },
      include: {
        courseLinks: { include: { course: { select: { id: true, name: true, type: true } } } },
      },
    });

    // Log changes
    const changes: string[] = [];
    for (const [key, value] of Object.entries(rest)) {
      const old = (video as any)[key];
      if (old !== value) {
        changes.push(`修改${key}`);
      }
    }
    if (courseIds) changes.push('更新关联课程');

    await this.prisma.videoCourseLog.create({
      data: { videoCourseId: id, action: changes.join('；') || '更新视频信息', operatorId: userId },
    });

    return updated;
  }

  async delete(id: number, userId: number) {
    const video = await this.findOne(id);
    if (video.status !== 'UNPUBLISHED') throw new BadRequestException('请先下架后再删除');
    await this.prisma.videoCourseLog.create({
      data: { videoCourseId: id, action: '删除视频课程', operatorId: userId },
    });
    return this.prisma.videoCourse.delete({ where: { id } });
  }

  // 日志查询
  async getLogs(videoCourseId: number) {
    return this.prisma.videoCourseLog.findMany({
      where: { videoCourseId },
      include: { operator: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 学员端：获取进度
  async getProgress(videoId: number, studentId: number) {
    return this.prisma.videoProgress.findUnique({
      where: { videoId_studentId: { videoId, studentId } },
    });
  }

  async reportProgress(videoId: number, studentId: number, dto: { progress: number; lastPosition: number; completed?: boolean }) {
    const { progress, lastPosition, completed } = dto;
    const existing = await this.prisma.videoProgress.findUnique({
      where: { videoId_studentId: { videoId, studentId } },
    });
    const record = await this.prisma.videoProgress.upsert({
      where: { videoId_studentId: { videoId, studentId } },
      create: { videoId, studentId, progress, lastPosition, completed: completed || false, completedAt: completed ? new Date() : null },
      update: { progress, lastPosition, ...(completed ? { completed: true, completedAt: new Date() } : {}) },
    });
    // Trigger learning hours on first completion
    if (completed && (!existing || !existing.completed)) {
      await this.recordLearningHours(videoId, studentId);
    }
    return record;
  }

  private async recordLearningHours(videoId: number, studentId: number) {
    const video = await this.prisma.videoCourse.findUnique({ where: { id: videoId } });
    if (!video || !video.hours || video.hours <= 0) return;

    const existing = await this.prisma.learningHourRecord.findFirst({
      where: { studentId, source: 'VIDEO', sourceId: videoId },
    });
    if (existing) return;

    await this.prisma.learningHourRecord.create({
      data: { studentId, source: 'VIDEO', sourceId: videoId, hours: video.hours, programId: null },
    });
  }

  // 学员端：获取学员可见的视频列表
  async findVisibleForStudent(studentId: number) {
    // 1. Get student's enrolled programs → courses
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { studentId },
      include: { program: { include: { schedules: { select: { courseId: true } } } } },
    });
    const enrolledCourseIds = new Set<number>();
    for (const e of enrollments) {
      for (const s of e.program.schedules) {
        if (s.courseId) enrolledCourseIds.add(s.courseId);
      }
    }

    // 2. PUBLIC videos (all students can see)
    // 3. SPECIALIZED videos linked to enrolled courses
    const publicVideos = await this.prisma.videoCourse.findMany({
      where: { type: 'PUBLIC', status: 'PUBLISHED' },
      include: { courseLinks: { include: { course: { select: { id: true, name: true } } } } },
      orderBy: { sortOrder: 'asc' },
    });

    const specializedVideos = await this.prisma.videoCourse.findMany({
      where: {
        type: 'SPECIALIZED', status: 'PUBLISHED',
        courseLinks: { some: { courseId: { in: Array.from(enrolledCourseIds) } } },
      },
      include: { courseLinks: { include: { course: { select: { id: true, name: true } } } } },
      orderBy: { sortOrder: 'asc' },
    });

    // 4. Attach progress for each video
    const allVideos = [...publicVideos, ...specializedVideos];
    const withProgress = await Promise.all(
      allVideos.map(async (v) => {
        const progress = await this.prisma.videoProgress.findUnique({
          where: { videoId_studentId: { videoId: v.id, studentId } },
        });
        return { ...v, progress };
      }),
    );

    // 5. Stats
    const totalVideos = allVideos.length;
    const completedVideos = withProgress.filter(v => v.progress?.completed).length;
    const totalHours = (await this.prisma.learningHourRecord.aggregate({
      where: { studentId, source: 'VIDEO' },
      _sum: { hours: true },
    }))._sum.hours || 0;

    return {
      videos: withProgress,
      stats: { totalVideos, completedVideos, totalHours: Math.round(totalHours * 100) / 100 },
    };
  }

  async publish(id: number, userId: number) {
    const video = await this.findOne(id);
    if (video.status === 'PUBLISHED') return video;
    const updated = await this.prisma.videoCourse.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    await this.prisma.videoCourseLog.create({
      data: { videoCourseId: id, action: '发布视频课程', operatorId: userId },
    });
    return updated;
  }

  async unpublish(id: number, userId: number) {
    const video = await this.findOne(id);
    if (video.status === 'DRAFT' || video.status === 'UNPUBLISHED') return video;
    const updated = await this.prisma.videoCourse.update({
      where: { id },
      data: { status: 'UNPUBLISHED' },
    });
    await this.prisma.videoCourseLog.create({
      data: { videoCourseId: id, action: '下架视频课程', operatorId: userId },
    });
    return updated;
  }
}