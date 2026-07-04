import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';

// AGENCY_ADMIN 可以创建的角色白名单（不可创建管理员角色）
const AGENCY_MANAGEABLE_ROLES = ['PROCTOR', 'LECTURER', 'STUDENT'];

@Injectable()
export class EnrollmentAgenciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, params: { page?: number; keyword?: string }) {
    const page = params.page || 1;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
    // AGENCY_ADMIN 只看自己的机构
    if (user?.roles?.includes('AGENCY_ADMIN') && user.primaryAgencyId) {
      where.id = user.primaryAgencyId;
    }
    const [items, total] = await Promise.all([
      this.prisma.enrollmentAgency.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
      this.prisma.enrollmentAgency.count({ where }),
    ]);
    return { items, total, page, pageSize: 20, totalPages: Math.ceil(total / 20) };
  }

  async findOne(id: number) { return this.prisma.enrollmentAgency.findUnique({ where: { id } }); }
  async create(data: any) { return this.prisma.enrollmentAgency.create({ data }); }
  async update(id: number, data: any) { return this.prisma.enrollmentAgency.update({ where: { id }, data }); }
  async delete(id: number) { return this.prisma.enrollmentAgency.delete({ where: { id } }); }

  async findStudents(agencyId: number, query: { page?: number; keyword?: string }) {
    const where: any = { primaryAgencyId: agencyId };
    if (query.keyword) {
      where.OR = [
        { displayName: { contains: query.keyword } },
        { username: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ];
    }
    const page = query.page || 1;
    const pageSize = 20;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, take: pageSize, skip: (page - 1) * pageSize, orderBy: { createdAt: 'desc' },
        select: { id: true, displayName: true, username: true, phone: true, email: true, studentNumber: true, idCard: true, title: true, gender: true, organization: true } }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findStudentProgress(agencyId: number, studentId?: number) {
    const where: any = { primaryAgencyId: agencyId };
    if (studentId) where.id = studentId;
    const students = await this.prisma.user.findMany({ where, select: { id: true, displayName: true, studentNumber: true } });
    return Promise.all(students.map(async (s) => {
      const hours = await this.prisma.learningHourRecord.aggregate({ where: { studentId: s.id, status: 'APPROVED' }, _sum: { hours: true } });
      const enrollments = await this.prisma.programEnrollment.count({ where: { studentId: s.id } });
      const certs = await this.prisma.certificate.count({ where: { studentId: s.id, isRevoked: false } });
      return { studentId: s.id, displayName: s.displayName, studentNumber: s.studentNumber, totalHours: hours._sum.hours || 0, enrollments, certificates: certs };
    }));
  }

  async findEnrollments(agencyId: number, studentId?: number) {
    const where: any = { agencyId };
    if (studentId) where.studentId = studentId;
    return this.prisma.programEnrollment.findMany({ where,
      include: { student: { select: { id: true, displayName: true } }, program: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════
  // 机构成员管理
  // ═══════════════════════════════════

  async findMembers(agencyId: number) {
    return this.prisma.user.findMany({
      where: { primaryAgencyId: agencyId },
      select: { id: true, displayName: true, username: true, phone: true, email: true, isActive: true,
        roleAssignments: { select: { role: { select: { code: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMember(agencyId: number, data: { displayName: string; username: string; phone?: string; roleCode: string }) {
    // 校验角色白名单
    if (!AGENCY_MANAGEABLE_ROLES.includes(data.roleCode)) {
      throw new ForbiddenException(`不允许创建 ${data.roleCode} 角色`);
    }

    // 检查用户名是否已存在
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictException('用户名已存在');

    // 获取目标角色
    const role = await this.prisma.role.findUnique({ where: { code: data.roleCode } });
    if (!role) throw new ForbiddenException('角色不存在');

    // 创建用户
    const passwordHash = await bcrypt.hash('123456', 10);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        displayName: data.displayName,
        phone: data.phone || null,
        primaryAgencyId: agencyId,
      },
    });

    // 分配角色
    await this.prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId: role.id },
    });

    return { id: user.id, displayName: user.displayName, username: user.username, role: data.roleCode };
  }

  async updateMemberRole(agencyId: number, userId: number, roleCode: string) {
    if (!AGENCY_MANAGEABLE_ROLES.includes(roleCode)) {
      throw new ForbiddenException(`不允许分配 ${roleCode} 角色`);
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, primaryAgencyId: agencyId } });
    if (!user) throw new ForbiddenException('用户不属于本机构');

    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new ForbiddenException('角色不存在');

    // 删除旧角色分配，创建新分配
    await this.prisma.userRoleAssignment.deleteMany({ where: { userId } });
    await this.prisma.userRoleAssignment.create({ data: { userId, roleId: role.id } });

    return { userId, role: roleCode };
  }

  async removeMember(agencyId: number, userId: number) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, primaryAgencyId: agencyId } });
    if (!user) throw new ForbiddenException('用户不属于本机构');

    // 移除角色分配，再停用用户（不物理删除）
    await this.prisma.userRoleAssignment.deleteMany({ where: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });

    return { userId, status: 'deactivated' };
  }

  // ═══════════════════════════════════════════
  //   机构质量雷达图
  // ═══════════════════════════════════════════

  async getRadar(params: {
    agencyId?: number;
    year?: number;
    quarter?: number;
    monthStart?: string;
    monthEnd?: string;
  }) {
    // ── 时间范围 ──
    let startDate: Date;
    let endDate: Date;
    let timeLabel: string;

    if (params.monthStart && params.monthEnd) {
      startDate = new Date(`${params.monthStart}-01`);
      endDate = new Date(`${params.monthEnd}-01`);
      endDate.setMonth(endDate.getMonth() + 1);
      timeLabel = `${params.monthStart} ~ ${params.monthEnd}`;
    } else if (params.quarter && params.year) {
      const qMap: Record<number, [number, number]> = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };
      const [sm, em] = qMap[params.quarter] || [1, 12];
      startDate = new Date(params.year, sm - 1, 1);
      endDate = new Date(params.year, em, 1);
      timeLabel = `${params.year} Q${params.quarter}`;
    } else {
      const y = params.year || new Date().getFullYear();
      startDate = new Date(y, 0, 1);
      endDate = new Date(y + 1, 0, 1);
      timeLabel = `${y}年`;
    }

    // ── 获取所有机构（或指定机构） ──
    const agencyWhere: any = { isActive: true };
    if (params.agencyId) agencyWhere.id = params.agencyId;
    const agencies = await this.prisma.enrollmentAgency.findMany({
      where: agencyWhere,
      select: { id: true, name: true },
    });

    if (agencies.length === 0) {
      return { agencies: [], averages: null, timeRange: { label: timeLabel } };
    }

    // ── 对每个机构计算维度 ──
    const agencyResults = await Promise.all(agencies.map(async (agency) => {
      // 该机构的招生记录（时间范围内）
      const enrollments = await this.prisma.programEnrollment.findMany({
        where: {
          agencyId: agency.id,
          createdAt: { gte: startDate, lt: endDate },
        },
        select: {
          id: true,
          studentId: true,
          programId: true,
          status: true,
        },
      });

      const totalStudents = enrollments.length;
      if (totalStudents === 0) {
        return {
          id: agency.id,
          name: agency.name,
          dimensions: {
            capacityUtilization: null,
            attendanceRate: null,
            passRate: null,
            studentActivity: null,
            certConversion: null,
            retention: null,
          },
          dimensionDetails: {
            capacityUtilization: { numerator: 0, denominator: 0 },
            attendanceRate: { numerator: 0, denominator: 0 },
            passRate: { numerator: 0, denominator: 0 },
            studentActivity: { numerator: 0, denominator: 0 },
            certConversion: { numerator: 0, denominator: 0 },
            retention: { numerator: 0, denominator: 0 },
          },
          totalStudents: 0,
          activePrograms: 0,
        };
      }

      const studentIds = [...new Set(enrollments.map(e => e.studentId))];
      const programIds = [...new Set(enrollments.map(e => e.programId))];
      const droppedCount = enrollments.filter(e => e.status === 'DROPPED').length;

      // ── 招生能力 ──
      const programs = await this.prisma.trainingProgram.findMany({
        where: { id: { in: programIds } },
        select: { id: true, maxStudents: true },
      });
      const totalCapacity = programs.reduce((s, p) => s + (p.maxStudents || 0), 0);
      const capacityUtilization = totalCapacity > 0
        ? Math.round((totalStudents / totalCapacity) * 10000) / 100
        : null;

      // ── 参考率 ──
      const examsForPrograms = await this.prisma.exam.findMany({
        where: { programId: { in: programIds } },
        select: { id: true },
      });
      const examIds = examsForPrograms.map(e => e.id);

      let examinedStudents: number[] = [];
      if (examIds.length > 0) {
        const sessions = await this.prisma.examSession.findMany({
          where: { examId: { in: examIds }, studentId: { in: studentIds }, status: 'SUBMITTED' },
          select: { studentId: true },
        });
        examinedStudents = [...new Set(sessions.map(s => s.studentId))];
      }
      const attendanceRate = totalStudents > 0
        ? Math.round((examinedStudents.length / totalStudents) * 10000) / 100
        : null;

      // ── 通过率 ──
      let passedStudents: number[] = [];
      if (examIds.length > 0) {
        const passed = await this.prisma.examSession.findMany({
          where: { examId: { in: examIds }, studentId: { in: studentIds }, isPassed: true },
          select: { studentId: true },
        });
        passedStudents = [...new Set(passed.map(s => s.studentId))];
      }
      const passRate = examinedStudents.length > 0
        ? Math.round((passedStudents.length / examinedStudents.length) * 10000) / 100
        : null;

      // ── 学员活跃度 ──
      // 活跃 = 参加考试 OR 完成课程
      let activeStudents = new Set(examinedStudents);
      // 已完成视频学习的学员
      const completedVideos = await this.prisma.videoProgress.findMany({
        where: { studentId: { in: studentIds }, completed: true },
        select: { studentId: true },
      });
      for (const v of completedVideos) activeStudents.add(v.studentId);
      // 有出勤记录的学员
      const attendanceStudents = await this.prisma.attendanceRecord.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true },
      });
      for (const a of attendanceStudents) activeStudents.add(a.studentId);

      const studentActivity = totalStudents > 0
        ? Math.round((activeStudents.size / totalStudents) * 10000) / 100
        : null;

      // ── 证书转化率 ──
      const certs = await this.prisma.certificate.findMany({
        where: { studentId: { in: studentIds }, programId: { in: programIds }, isRevoked: false },
        select: { studentId: true },
      });
      const certStudentIds = [...new Set(certs.map(c => c.studentId))];
      const certConversion = totalStudents > 0
        ? Math.round((certStudentIds.length / totalStudents) * 10000) / 100
        : null;

      // ── 退学控制 ──
      const retention = totalStudents > 0
        ? Math.round((1 - droppedCount / totalStudents) * 10000) / 100
        : null;

      // ── 活跃培训班数（去重） ──
      const activeEnrollments = await this.prisma.programEnrollment.findMany({
        where: { agencyId: agency.id, createdAt: { gte: startDate, lt: endDate },
          program: { status: { in: ['ENROLLING', 'IN_PROGRESS', 'REVIEWING', 'CERTIFYING'] } } },
        select: { programId: true },
        distinct: ['programId'],
      });
      const activePrograms = activeEnrollments.length;

      return {
        id: agency.id,
        name: agency.name,
        dimensions: {
          capacityUtilization,
          attendanceRate,
          passRate,
          studentActivity,
          certConversion,
          retention,
        },
        dimensionDetails: {
          capacityUtilization: { numerator: totalStudents, denominator: totalCapacity },
          attendanceRate: { numerator: examinedStudents.length, denominator: totalStudents },
          passRate: { numerator: passedStudents.length, denominator: examinedStudents.length },
          studentActivity: { numerator: activeStudents.size, denominator: totalStudents },
          certConversion: { numerator: certStudentIds.length, denominator: totalStudents },
          retention: { numerator: totalStudents - droppedCount, denominator: totalStudents },
        },
        totalStudents,
        activePrograms,
      };
    }));

    // ── 计算所有机构的平均分 ──
    const dims = ['capacityUtilization', 'attendanceRate', 'passRate', 'studentActivity', 'certConversion', 'retention'] as const;
    const averages: Record<string, number> = {};
    for (const dim of dims) {
      const vals = agencyResults.map(a => a.dimensions[dim]).filter((v): v is number => v !== null);
      averages[dim] = vals.length > 0
        ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100
        : 0;
    }

    return {
      agencies: agencyResults,
      averages,
      timeRange: { type: params.monthStart ? 'custom' : params.quarter ? 'quarter' : 'year', label: timeLabel },
    };
  }
}