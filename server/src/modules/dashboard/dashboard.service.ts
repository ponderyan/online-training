import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(user: any) {
    const roles: string[] = user?.roles || [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── 全局数据（仅 SUPER_ADMIN / ORG_ADMIN）──
    let global: any = {};
    if (roles.includes('SUPER_ADMIN') || roles.includes('ORG_ADMIN')) {
      // ★ ORG_ADMIN 数据隔离：仅看本组织及子孙组织的数据
      const isSuperAdmin = roles.includes('SUPER_ADMIN');
      const orgIds = isSuperAdmin ? null : await this.getOrgScope(user.orgId);
      const orgFilter = orgIds ? { orgId: { in: orgIds } } : {};

      const [
        activePrograms, totalStudents, totalInstructors,
        pendingGrading, pendingAppeals, pendingCerts,
        recentPrograms, upcomingExams, monthlyStudents,
      ] = await Promise.all([
        this.prisma.trainingProgram.count({ where: { ...orgFilter, status: 'IN_PROGRESS' } }),
        orgIds
          ? this.prisma.user.count({ where: { orgId: { in: orgIds }, isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } } })
          : this.getUserCountByRole('STUDENT'),
        this.prisma.instructor.count({ where: { status: 'ACTIVE' } }),
        this.prisma.examSession.count({
          where: { status: 'SUBMITTED', scoringStatus: { in: ['PENDING', 'GRADING'] },
            ...(orgIds ? { exam: { orgId: { in: orgIds } } } : {}) },
        }),
        this.prisma.scoreAppeal.count({ where: { status: 'PENDING' } }),
        this.prisma.certificateApplication.count({ where: { status: 'PENDING' } }),
        this.prisma.trainingProgram.findMany({
          where: { ...orgFilter },
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true },
        }),
        this.prisma.exam.findMany({
          where: { ...orgFilter, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
          orderBy: { startTime: 'asc' }, take: 3,
          select: { id: true, title: true, startTime: true, endTime: true, status: true },
        }),
        orgIds
          ? this.prisma.user.count({ where: { orgId: { in: orgIds }, createdAt: { gte: startOfMonth }, isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } } })
          : this.getNewUserCountByRole('STUDENT', startOfMonth),
      ]);
      global = { activePrograms, totalStudents, totalInstructors, pendingGrading, pendingAppeals, pendingCerts, recentPrograms, upcomingExams, monthlyStudents };
    }

    // ── EXAM_OFFICER 专属（按 orgId 隔离）──
    let examOfficer: any = {};
    if (roles.includes('EXAM_OFFICER')) {
      const eoOrgIds = roles.includes('SUPER_ADMIN') ? null : await this.getOrgScope(user.orgId);
      const eoOrgFilter = eoOrgIds ? { orgId: { in: eoOrgIds } } : {};
      const [totalQuestions, totalPapers, examCount, pendingGradingCount] = await Promise.all([
        this.prisma.question.count({ where: { ...eoOrgFilter } }),
        this.prisma.paper.count({ where: { ...eoOrgFilter } }),
        this.prisma.exam.count({ where: { ...eoOrgFilter } }),
        this.prisma.examSession.count({
          where: { status: 'SUBMITTED', scoringStatus: { in: ['PENDING', 'GRADING'] },
            ...(eoOrgIds ? { exam: { orgId: { in: eoOrgIds } } } : {}) },
        }),
      ]);
      examOfficer = {
        totalQuestions, totalPapers, examCount, pendingGradingCount,
        totalStudents: eoOrgIds
          ? await this.prisma.user.count({ where: { orgId: { in: eoOrgIds }, isActive: true, roleAssignments: { some: { role: { code: 'STUDENT' } } } } })
          : await this.getUserCountByRole('STUDENT'),
        pendingAppeals: await this.prisma.scoreAppeal.count({
          where: { status: 'PENDING', ...(eoOrgIds ? { exam: { orgId: { in: eoOrgIds } } } : {}) },
        }),
        upcomingExams: await this.prisma.exam.findMany({
          where: { ...eoOrgFilter, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
          orderBy: { startTime: 'asc' }, take: 3,
          select: { id: true, title: true, startTime: true, endTime: true, status: true },
        }),
      };
    }

    // ── LECTURER 专属（仅统计与自己相关的数据）──
    let lecturer: any = {};
    if (roles.includes('LECTURER')) {
      const lecOrgIds = roles.includes('SUPER_ADMIN') ? null : await this.getOrgScope(user.orgId);
      lecturer = {
        myQuestions: await this.prisma.question.count({ where: { createdBy: user.sub } }),
        // 待阅卷：仅统计分配给自己的阅卷任务
        pendingGradingCount: await this.prisma.gradingAssignment.count({
          where: { graderId: user.sub, status: 'PENDING' },
        }),
        programCount: await this.prisma.trainingProgram.count({
          where: { status: 'IN_PROGRESS', ...(lecOrgIds ? { orgId: { in: lecOrgIds } } : {}) },
        }),
      };
    }

    // ── PROCTOR 专属（按 orgId 隔离）──
    let proctor: any = {};
    if (roles.includes('PROCTOR')) {
      const pcOrgIds = roles.includes('SUPER_ADMIN') ? null : await this.getOrgScope(user.orgId);
      const pcOrgFilter = pcOrgIds ? { orgId: { in: pcOrgIds } } : {};
      proctor = {
        activeExams: await this.prisma.exam.count({ where: { ...pcOrgFilter, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } } }),
        upcomingExams: await this.prisma.exam.findMany({
          where: { ...pcOrgFilter, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
          orderBy: { startTime: 'asc' }, take: 5,
          select: { id: true, title: true, startTime: true, endTime: true, status: true },
        }),
      };
    }

    // ── AGENCY_ADMIN 专属（严格按 primaryAgencyId 隔离）──
    let agency: any = {};
    if (roles.includes('AGENCY_ADMIN')) {
      const agencyId = user.primaryAgencyId;
      if (agencyId) {
        const studentIds = (await this.prisma.user.findMany({
          where: { primaryAgencyId: agencyId }, select: { id: true },
        })).map(u => u.id);
        const [totalStudents, pendingCertificates, totalEnrollments, recentEnrollments] = await Promise.all([
          this.prisma.user.count({ where: { primaryAgencyId: agencyId, isActive: true } }),
          this.prisma.certificateApplication.count({
            where: { studentId: { in: studentIds }, status: 'PENDING' },
          }),
          this.prisma.programEnrollment.count({ where: { agencyId } }),
          this.prisma.programEnrollment.findMany({
            where: { agencyId }, orderBy: { createdAt: 'desc' }, take: 5,
            select: { id: true, createdAt: true, student: { select: { displayName: true } }, program: { select: { name: true } } },
          }),
        ]);
        agency = { totalStudents, pendingCertificates, totalEnrollments, recentEnrollments };
      } else {
        agency = { totalStudents: 0, pendingCertificates: 0, totalEnrollments: 0, recentEnrollments: [] };
      }
    }

    // ── AUDITOR 专属 ──
    let auditor: any = {};
    if (roles.includes('AUDITOR')) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      auditor = {
        todayLogCount: await this.prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
        totalLogCount: await this.prisma.auditLog.count(),
        recentLogs: await this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { id: true, entityType: true, action: true, createdAt: true },
        }),
      };
    }

    return {
      roles,
      global,
      examOfficer,
      lecturer,
      proctor,
      agency,
      auditor,
    };
  }

  private async getUserCountByRole(code: string): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) return 0;
    return this.prisma.userRoleAssignment.count({ where: { roleId: role.id, user: { isActive: true } } });
  }

  private async getNewUserCountByRole(code: string, after: Date): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) return 0;
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { roleId: role.id }, select: { userId: true },
    });
    const ids = assignments.map(a => a.userId);
    if (ids.length === 0) return 0;
    return this.prisma.user.count({ where: { id: { in: ids }, createdAt: { gte: after }, isActive: true } });
  }

  /** 获取组织范围：本组织 + 所有子孙组织 ID */
  private async getOrgScope(orgId: number | null): Promise<number[] | null> {
    if (!orgId) return null;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } });
    if (!org?.path) return [orgId];
    const descendants = await this.prisma.organization.findMany({
      where: { path: { startsWith: org.path } },
      select: { id: true },
    });
    return descendants.map(d => d.id);
  }
}
