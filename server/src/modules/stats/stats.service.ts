import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getExamOverview() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      distinctExamIds,
      totalAttempts,
      passedAttempts,
      avgResult,
      recentSessions,
    ] = await Promise.all([
      this.prisma.examSession.findMany({
        select: { examId: true },
        distinct: ['examId'],
      }),
      this.prisma.examSession.count({
        where: { submittedAt: { not: null } },
      }),
      this.prisma.examSession.count({
        where: { isPassed: true },
      }),
      this.prisma.examSession.aggregate({
        _avg: { finalScore: true },
        where: { submittedAt: { not: null } },
      }),
      this.prisma.examSession.findMany({
        where: { submittedAt: { not: null, gte: thirtyDaysAgo } },
        select: { submittedAt: true, isPassed: true },
      }),
    ]);

    const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
    const avgScore = avgResult._avg.finalScore || 0;

    // Build recentTrend — last 30 days with zero-filled gaps
    const dateMap = new Map<string, { attempts: number; passed: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { attempts: 0, passed: 0 });
    }
    for (const s of recentSessions) {
      if (!s.submittedAt) continue;
      const key = s.submittedAt.toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) {
        entry.attempts++;
        if (s.isPassed) entry.passed++;
      }
    }
    const recentTrend = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      attempts: data.attempts,
      passed: data.passed,
      passRate: data.attempts > 0 ? (data.passed / data.attempts) * 100 : 0,
    }));

    return {
      totalExams: distinctExamIds.length,
      totalAttempts,
      passedAttempts,
      passRate: Math.round(passRate * 100) / 100,
      avgScore: Math.round((avgScore as number) * 100) / 100,
      recentTrend,
    };
  }

  async getHoursOverview() {
    const [
      distinctStudentRecords,
      totalRecords,
      approvedHoursResult,
      approvedCount,
      approvedRecords,
    ] = await Promise.all([
      this.prisma.learningHourRecord.findMany({
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.learningHourRecord.count(),
      this.prisma.learningHourRecord.aggregate({
        _sum: { hours: true },
        where: { status: 'APPROVED' },
      }),
      this.prisma.learningHourRecord.count({ where: { status: 'APPROVED' } }),
      this.prisma.learningHourRecord.findMany({
        where: { status: 'APPROVED' },
        select: {
          studentId: true,
          hours: true,
          program: {
            select: {
              org: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const approvedRate = totalRecords > 0 ? (approvedCount / totalRecords) * 100 : 0;
    const totalApprovedHours = approvedHoursResult._sum.hours || 0;

    // Build agencyBreakdown — group by program's organization
    const agencyMap = new Map<number, { agencyName: string; studentSet: Set<number>; totalHours: number }>();
    for (const r of approvedRecords) {
      const org = r.program?.org;
      if (!org) continue;
      let entry = agencyMap.get(org.id);
      if (!entry) {
        entry = { agencyName: org.name, studentSet: new Set(), totalHours: 0 };
        agencyMap.set(org.id, entry);
      }
      entry.studentSet.add(r.studentId);
      entry.totalHours += r.hours;
    }
    const agencyBreakdown = Array.from(agencyMap.entries()).map(([agencyId, data]) => ({
      agencyId,
      agencyName: data.agencyName,
      studentCount: data.studentSet.size,
      totalHours: data.totalHours,
    }));

    return {
      totalStudents: distinctStudentRecords.length,
      totalRecords,
      totalApprovedHours,
      approvedRate: Math.round(approvedRate * 100) / 100,
      agencyBreakdown,
    };
  }

  async getCertOverview() {
    const [totalIssued, totalRevoked, allCerts] = await Promise.all([
      this.prisma.certificate.count({ where: { isRevoked: false } }),
      this.prisma.certificate.count({ where: { isRevoked: true } }),
      this.prisma.certificate.findMany({
        select: { issueDate: true, isRevoked: true },
      }),
    ]);

    // Build monthlyBreakdown
    const monthMap = new Map<string, { issued: number; revoked: number }>();
    for (const c of allCerts) {
      const month = `${c.issueDate.getFullYear()}-${String(c.issueDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthMap.get(month) || { issued: 0, revoked: 0 };
      if (c.isRevoked) {
        entry.revoked++;
      } else {
        entry.issued++;
      }
      monthMap.set(month, entry);
    }
    const monthlyBreakdown = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { totalIssued, totalRevoked, monthlyBreakdown };
  }

  async getStudentActivity() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Resolve STUDENT role and get active student IDs
    const studentRole = await this.prisma.role.findUnique({ where: { code: 'STUDENT' } });
    if (!studentRole) {
      return { totalStudents: 0, activeThisMonth: 0, completionRate: 0, inactiveCount: 0 };
    }

    const studentAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { roleId: studentRole.id, user: { isActive: true } },
      select: { userId: true },
    });
    const studentIds = studentAssignments.map(a => a.userId);
    const totalStudents = studentIds.length;

    if (totalStudents === 0) {
      return { totalStudents: 0, activeThisMonth: 0, completionRate: 0, inactiveCount: 0 };
    }

    const [activeExamStudents, activeHoursStudents, completedEnrollments] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { studentId: { in: studentIds }, submittedAt: { gte: startOfMonth } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.learningHourRecord.findMany({
        where: { studentId: { in: studentIds }, recordedAt: { gte: startOfMonth } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.programEnrollment.findMany({
        where: { studentId: { in: studentIds }, completedAt: { not: null } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);

    const activeSet = new Set<number>();
    for (const s of activeExamStudents) activeSet.add(s.studentId);
    for (const s of activeHoursStudents) activeSet.add(s.studentId);
    const activeThisMonth = activeSet.size;

    const completedStudentIds = completedEnrollments.map(e => e.studentId);
    const completedSet = new Set(completedStudentIds);
    const completionRate = (completedSet.size / totalStudents) * 100;

    return {
      totalStudents,
      activeThisMonth,
      completionRate: Math.round(completionRate * 100) / 100,
      inactiveCount: totalStudents - activeThisMonth,
    };
  }
}
