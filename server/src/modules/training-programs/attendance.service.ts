import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getByProgram(programId: number) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { programId },
      include: {
        student: { select: { displayName: true, organization: true } },
        modifiedBy: { select: { displayName: true } },
      },
    });
    // Auto-create records for enrolled students without one
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { programId, studentId: { notIn: records.map(r => r.studentId) } },
      include: { student: { select: { displayName: true, organization: true } } },
    });
    const defaults: any[] = await Promise.all(enrollments.map(async (e, index) => {
      const scheduleCount = await this.prisma.schedule.count({ where: { programId } });
      return { id: -(index + 1), programId, studentId: e.studentId, student: e.student, totalDays: scheduleCount, actualDays: 0, attendanceRate: 0, source: 'MANUAL', modifiedById: null, modifiedBy: null, modifiedReason: null };
    }));
    return [...records, ...defaults];
  }

  async update(programId: number, studentId: number, data: { actualDays: number; reason: string }, userId: number) {
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { programId_studentId: { programId, studentId } },
    });
    const totalDays = existing?.totalDays || (await this.prisma.schedule.count({ where: { programId } }));
    const attendanceRate = totalDays > 0 ? Math.round(data.actualDays / totalDays * 10000) / 100 : 0;

    if (existing) {
      return this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { actualDays: data.actualDays, attendanceRate, modifiedById: userId, modifiedReason: data.reason },
      });
    }
    return this.prisma.attendanceRecord.create({
      data: { programId, studentId, totalDays, actualDays: data.actualDays, attendanceRate, source: 'MANUAL', modifiedById: userId, modifiedReason: data.reason },
    });
  }
}
