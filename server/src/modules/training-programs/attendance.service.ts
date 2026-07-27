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

  async update(programId: number, studentId: number, data: { actualDays: number; reason: string; signInSheetUrl?: string }, userId: number) {
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { programId_studentId: { programId, studentId } },
    });
    const totalDays = existing?.totalDays || (await this.prisma.schedule.count({ where: { programId } }));
    const attendanceRate = totalDays > 0 ? Math.round(data.actualDays / totalDays * 10000) / 100 : 0;

    let attendance;
    if (existing) {
      attendance = await this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { actualDays: data.actualDays, attendanceRate, modifiedById: userId, modifiedReason: data.reason },
      });
    } else {
      attendance = await this.prisma.attendanceRecord.create({
        data: { programId, studentId, totalDays, actualDays: data.actualDays, attendanceRate, source: 'MANUAL', modifiedById: userId, modifiedReason: data.reason },
      });
    }

    // ── 出勤保存后自动生成 OFFLINE 学时 ──
    try {
      const program = await this.prisma.trainingProgram.findUnique({
        where: { id: programId },
        select: { hoursPerDay: true },
      });
      if (program?.hoursPerDay && data.actualDays > 0) {
        const hours = data.actualDays * program.hoursPerDay;
        const existingLHR = await this.prisma.learningHourRecord.findFirst({
          where: { studentId, programId, source: 'OFFLINE' },
          orderBy: { recordedAt: 'desc' },
        });
        if (existingLHR) {
          // 已有学时记录 → 更新 hours（出勤记录有完整变更历史，无需保留多个版本）
          await this.prisma.learningHourRecord.update({
            where: { id: existingLHR.id },
            data: { hours, status: 'APPROVED', evidenceUrl: data.signInSheetUrl ?? undefined },
          });
        } else {
          // 无记录 → 新建 APPROVED（管理员已核实出勤，无需二次审核）
          await this.prisma.learningHourRecord.create({
            data: {
              studentId, programId, source: 'OFFLINE', hours, status: 'APPROVED',
              evidenceUrl: data.signInSheetUrl ?? undefined, recordedAt: new Date(),
            },
          });
        }
      }
    } catch {} // 学时生成失败不影响出勤记录

    return attendance;
  }
}
