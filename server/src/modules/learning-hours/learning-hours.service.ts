import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class LearningHoursService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {}

  async findAll(params?: { studentId?: number; status?: string; programId?: number }) {
    const where: any = {};
    if (params?.studentId) where.studentId = params.studentId;
    if (params?.status) where.status = params.status;
    if (params?.programId) where.programId = params.programId;

    const [items, total] = await Promise.all([
      this.prisma.learningHourRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        include: {
          student: { select: { id: true, displayName: true, studentNumber: true, organization: true } },
          program: { select: { id: true, name: true } },
          type: { select: { id: true, name: true, code: true } },
        },
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
      include: {
        program: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, code: true } },
      },
    });

    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const completedVideos = records.filter(r => r.source === 'VIDEO').length;

    // Group by type
    const typeHours: Record<string, { typeName: string; typeCode: string; hours: number }> = {};
    for (const r of records) {
      if (r.type) {
        const key = r.type.code;
        if (!typeHours[key]) {
          typeHours[key] = { typeName: r.type.name, typeCode: r.type.code, hours: 0 };
        }
        typeHours[key].hours += r.hours;
      }
    }

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
      typeStats: Object.values(typeHours).map(t => ({
        ...t,
        hours: Math.round(t.hours * 100) / 100,
      })),
      programStats: Array.from(programMap.values()),
    };
  }

  async programStats(programId: number) {
    const records = await this.prisma.learningHourRecord.findMany({
      where: { programId },
      include: {
        student: { select: { id: true, displayName: true, studentNumber: true } },
        type: { select: { id: true, name: true, code: true } },
      },
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

    // 自动标记为公需科目
    const publicRequiredType = await this.prisma.learningHourType.findFirst({
      where: { code: 'PUBLIC_REQUIRED' },
    });

    // Create record for each linked program
    const programs = video.course?.programs || [];
    if (programs.length === 0) {
      await this.prisma.learningHourRecord.create({
        data: {
          studentId, source: 'VIDEO', sourceId: videoId, hours, programId: null,
          typeId: publicRequiredType?.id || null, status: 'APPROVED',
        },
      });
    } else {
      for (const program of programs) {
        await this.prisma.learningHourRecord.create({
          data: {
            studentId, source: 'VIDEO', sourceId: videoId, hours, programId: program.id,
            typeId: publicRequiredType?.id || null, status: 'APPROVED',
          },
        });
      }
    }
  }

  async getPendingHours(programId?: number, source?: string) {
    const where: any = { status: 'PENDING' };
    if (programId) where.programId = programId;
    if (source) where.source = source;
    return this.prisma.learningHourRecord.findMany({
      where,
      include: {
        student: { select: { id: true, displayName: true, studentNumber: true, organization: true } },
        program: { select: { id: true, name: true, hoursPerDay: true } },
        type: { select: { id: true, name: true, code: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  // V1 主方法：单条审核/驳回
  async review(id: number, action: 'approve' | 'reject', reviewerId: number, comment: string | null) {
    const record = await this.prisma.learningHourRecord.findUnique({ where: { id } });
    if (!record) throw new BadRequestException('记录不存在');
    if (record.status !== 'PENDING') throw new BadRequestException('该记录已审核');
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updated = await this.prisma.learningHourRecord.update({
      where: { id },
      data: { status, approvedById: reviewerId, approvedAt: new Date(), reviewComment: comment },
    });

    // 审核完成后通知学员
    const type = action === 'approve' ? 'LEARNING_HOUR_APPROVED' : 'LEARNING_HOUR_REJECTED';
    void this.notificationService.create(
      record.studentId,
      type as any,
      action === 'approve' ? '学时申报已通过' : '学时申报被驳回',
      action === 'approve' ? `学时申报已通过，共 ${record.hours} 学时` : `学时申报被驳回${comment ? '，原因：' + comment : ''}`,
      record.id, 'learning_hour',
    );

    return updated;
  }

  // 兼容旧路由：批量通过
  async approveHours(ids: number[], reviewerId: number, comment?: string) {
    let count = 0;
    for (const id of ids) {
      try { await this.review(id, 'approve', reviewerId, comment || null); count++; } catch {}
    }
    return { count };
  }

  // 兼容旧路由：批量驳回
  async rejectHours(ids: number[], reviewerId: number, comment: string) {
    let count = 0;
    for (const id of ids) {
      try { await this.review(id, 'reject', reviewerId, comment); count++; } catch {}
    }
    return { count };
  }

  async submit(studentId: number, data: {
    programId?: number; hours: number; source: string; typeId?: number;
    description?: string; note?: string; evidenceUrl?: string;
    operatorId?: number; operatorOrgId?: number | null;
  }) {
    // orgId 校验：申报人必须和学员在同一机构
    if (data.operatorOrgId) {
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { orgId: true, primaryAgencyId: true },
      });
      if (student && student.orgId && student.orgId !== data.operatorOrgId) {
        throw new ForbiddenException('不能跨机构申报学时');
      }
    }
    return this.prisma.learningHourRecord.create({
      data: {
        studentId,
        programId: data.programId || null,
        hours: data.hours,
        source: data.source || 'OFFLINE',
        typeId: data.typeId || null,
        description: data.description || data.note || null,
        note: data.note || null,
        status: 'PENDING',
        evidenceUrl: data.evidenceUrl || null,
        submittedById: data.operatorId || null,
      },
    });
  }
}