import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceAccessService } from '../../common/services/resource-access.service.js';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService, private resourceAccess: ResourceAccessService) {}

  /** 获取 org 过滤条件（非超管返回 visibleOrgIds，超管返回 null 表示不过滤） */
  private async resolveOrgScope(userOrgId: number | null, userRoles?: string[]): Promise<number[] | null> {
    const roles = userRoles ?? [];
    if (roles.includes('SUPER_ADMIN')) return null;
    if (!userOrgId) return [];
    return this.resourceAccess.getVisibleOrgIds(userOrgId);
  }

  async getExamOverview(userOrgId?: number | null, userRoles?: string[]) {
    const orgIds = await this.resolveOrgScope(userOrgId ?? null, userRoles);
    const examWhere = orgIds ? { orgId: { in: orgIds } } : {};
    const sessionWhere = orgIds ? { exam: { orgId: { in: orgIds } } } : {};

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
        where: { ...sessionWhere },
        select: { examId: true },
        distinct: ['examId'],
      }),
      this.prisma.examSession.count({
        where: { ...sessionWhere, submittedAt: { not: null } },
      }),
      this.prisma.examSession.count({
        where: { ...sessionWhere, isPassed: true },
      }),
      this.prisma.examSession.aggregate({
        _avg: { finalScore: true },
        where: { ...sessionWhere, submittedAt: { not: null } },
      }),
      this.prisma.examSession.findMany({
        where: { ...sessionWhere, submittedAt: { not: null, gte: thirtyDaysAgo } },
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

  async getHoursOverview(userOrgId?: number | null, userRoles?: string[]) {
    const orgIds = await this.resolveOrgScope(userOrgId ?? null, userRoles);
    // 学时记录通过 student.orgId 隔离
    const studentOrgFilter = orgIds ? { student: { orgId: { in: orgIds } } } : {};

    const [
      distinctStudents,
      totalRecords,
      approvedHoursResult,
      approvedCount,
    ] = await Promise.all([
      this.prisma.learningHourRecord.findMany({
        where: { ...studentOrgFilter },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.learningHourRecord.count({ where: { ...studentOrgFilter } }),
      this.prisma.learningHourRecord.aggregate({
        _sum: { hours: true },
        where: { ...studentOrgFilter, status: 'APPROVED' },
      }),
      this.prisma.learningHourRecord.count({ where: { ...studentOrgFilter, status: 'APPROVED' } }),
    ]);

    const approvedRate = totalRecords > 0 ? (approvedCount / totalRecords) * 100 : 0;
    const totalApprovedHours = approvedHoursResult._sum.hours || 0;

    // 使用 groupBy 替代内存聚合（P2 性能优化）
    const groupedByProgram = await this.prisma.learningHourRecord.groupBy({
      by: ['programId'],
      where: { ...studentOrgFilter, status: 'APPROVED', programId: { not: null } },
      _sum: { hours: true },
      _count: { studentId: true },
    });

    // 获取 program 对应的 org 信息
    const programIds = groupedByProgram.map(g => g.programId).filter(Boolean) as number[];
    const programs = programIds.length > 0
      ? await this.prisma.trainingProgram.findMany({
          where: { id: { in: programIds } },
          select: { id: true, org: { select: { id: true, name: true } } },
        })
      : [];
    const programOrgMap = new Map(programs.map(p => [p.id, p.org]));

    // 按 org 聚合
    const agencyMap = new Map<number, { agencyName: string; studentCount: number; totalHours: number }>();
    for (const g of groupedByProgram) {
      const org = programOrgMap.get(g.programId!);
      if (!org) continue;
      const entry = agencyMap.get(org.id) || { agencyName: org.name, studentCount: 0, totalHours: 0 };
      entry.studentCount += g._count.studentId;
      entry.totalHours += g._sum.hours || 0;
      agencyMap.set(org.id, entry);
    }
    const agencyBreakdown = Array.from(agencyMap.entries()).map(([agencyId, data]) => ({
      agencyId,
      agencyName: data.agencyName,
      studentCount: data.studentCount,
      totalHours: data.totalHours,
    }));

    return {
      totalStudents: distinctStudents.length,
      totalRecords,
      totalApprovedHours,
      approvedRate: Math.round(approvedRate * 100) / 100,
      agencyBreakdown,
    };
  }

  async getCertOverview(userOrgId?: number | null, userRoles?: string[]) {
    const orgIds = await this.resolveOrgScope(userOrgId ?? null, userRoles);
    const certWhere = orgIds ? { OR: [{ orgId: { in: orgIds } }, { orgId: null }] } : {};

    const [totalIssued, totalRevoked, allCerts] = await Promise.all([
      this.prisma.certificate.count({ where: { ...certWhere, isRevoked: false } }),
      this.prisma.certificate.count({ where: { ...certWhere, isRevoked: true } }),
      this.prisma.certificate.findMany({
        where: certWhere,
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

  async getStudentActivity(userOrgId?: number | null, userRoles?: string[]) {
    const orgIds = await this.resolveOrgScope(userOrgId ?? null, userRoles);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 使用 relation filter 替代先取 ID 再 in（P2 性能优化）
    const studentBaseWhere = orgIds
      ? { orgId: { in: orgIds }, isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } }
      : { isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } };

    const totalStudents = await this.prisma.user.count({ where: studentBaseWhere });
    if (totalStudents === 0) {
      return { totalStudents: 0, activeThisMonth: 0, completionRate: 0, inactiveCount: 0 };
    }

    // 本月活跃：有考试提交或学时记录的学员
    const studentRelationWhere = orgIds
      ? { orgId: { in: orgIds }, isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } }
      : { isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } };
    const [activeExamStudents, activeHoursStudents, completedEnrollments] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { student: studentRelationWhere, submittedAt: { gte: startOfMonth } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.learningHourRecord.findMany({
        where: { student: studentRelationWhere, recordedAt: { gte: startOfMonth } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.programEnrollment.findMany({
        where: { student: studentRelationWhere, completedAt: { not: null } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);

    const activeSet = new Set<number>();
    for (const s of activeExamStudents) activeSet.add(s.studentId);
    for (const s of activeHoursStudents) activeSet.add(s.studentId);
    const activeThisMonth = activeSet.size;

    const completedSet = new Set(completedEnrollments.map(e => e.studentId));
    const completionRate = (completedSet.size / totalStudents) * 100;

    return {
      totalStudents,
      activeThisMonth,
      completionRate: Math.round(completionRate * 100) / 100,
      inactiveCount: totalStudents - activeThisMonth,
    };
  }
}
