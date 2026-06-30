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
}