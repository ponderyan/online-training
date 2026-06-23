import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcryptjs from 'bcryptjs';

// 可查询的所有学员字段
const USER_SELECT = {
  id: true, username: true, displayName: true,
  studentNumber: true, phone: true, email: true, organization: true,
  title: true, gender: true, idCard: true, source: true, remark: true,
  feeStatus: true, enrolledAt: true, graduatedAt: true,
  tags: true,
  batchId: true, isActive: true,
  lastLoginAt: true, loginCount: true,
  createdAt: true, updatedAt: true,
  education: true, educationSchool: true, major: true, graduationDate: true,
  professionalTitle: true, professionalLevel: true,
  batch: { select: { id: true, name: true } },
  roleAssignments: {
    select: {
      role: { select: { code: true, name: true } },
    },
  },
};

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number; pageSize?: number; keyword?: string;
    groupId?: number; status?: string; source?: string; feeStatus?: string;
    allRoles?: boolean;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (!params.allRoles) where.roleAssignments = { some: { role: { code: 'STUDENT' } } };
    if (params.keyword) {
      where.OR = [
        { displayName: { contains: params.keyword } },
        { username: { contains: params.keyword } },
        { studentNumber: { contains: params.keyword } },
        { phone: { contains: params.keyword } },
        { organization: { contains: params.keyword } },
        { idCard: { contains: params.keyword } },
      ];
    }
    if (params.groupId) where.batchId = params.groupId;
    if (params.source) where.source = params.source;
    if (params.feeStatus) where.feeStatus = params.feeStatus;
    if (params.status === 'active') where.isActive = true;
    else if (params.status === 'inactive') where.isActive = false;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    // 脱敏身份证号 + 展平角色
    const masked = items.map(u => ({
      ...u,
      idCard: u.idCard ? u.idCard.slice(0, 3) + '********' + u.idCard.slice(-4) : null,
      roles: (u as any).roleAssignments?.map((ra: any) => ra.role.code) || [(u as any).role || 'STUDENT'],
    }));

    return { items: masked, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('用户不存在');
    // 脱敏
    if (user.idCard) user.idCard = user.idCard.slice(0, 3) + '********' + user.idCard.slice(-4);
    return user;
  }

  /** 学员详情：基本信息 + 统计摘要 */
  async getProfile(id: number) {
    const user = await this.findOne(id);
    const [examCount, passedCount, certCount] = await Promise.all([
      this.prisma.examSession.count({ where: { studentId: id, status: 'SUBMITTED' } }),
      this.prisma.examSession.count({ where: { studentId: id, isPassed: true } }),
      this.prisma.certificate.count({ where: { studentId: id, isRevoked: false } }),
    ]);
    return { ...user, stats: { examCount, passedCount, certCount, passRate: examCount > 0 ? Math.round(passedCount / examCount * 100) : 0 } };
  }

  /** 学员考试记录 */
  async getExamHistory(id: number, page = 1, pageSize = 10) {
    const where = { studentId: id, status: 'SUBMITTED' };
    const [items, total] = await Promise.all([
      this.prisma.examSession.findMany({
        where,
        include: { exam: { select: { id: true, title: true } } },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.examSession.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /** 学员证书 */
  async getCertificates(id: number) {
    return this.prisma.certificate.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 学员缴费记录 */
  async getFeeRecords(id: number) {
    return this.prisma.feeRecord.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 添加缴费记录 */
  async addFeeRecord(data: {
    studentId: number; examId?: number; type: string; amount: number;
    status: string; paidAt?: string; method?: string; invoiceNo?: string; note?: string; operatorId?: number;
  }) {
    return this.prisma.feeRecord.create({ data: { ...data, paidAt: data.paidAt ? new Date(data.paidAt) : undefined } });
  }

  /** 更新缴费状态 */
  async updateFeeStatus(studentId: number, feeStatus: string) {
    return this.prisma.user.update({ where: { id: studentId }, data: { feeStatus }, select: { id: true, feeStatus: true } });
  }

  // ── CRUD ──

  async create(data: {
    username: string; displayName: string; password?: string;
    studentNumber?: string; phone?: string; email?: string;
    organization?: string; groupId?: number; role?: string;
    title?: string; gender?: string; idCard?: string; source?: string; remark?: string;
    feeStatus?: string; enrolledAt?: string; tags?: string[];
    roles?: string[];
    batchId?: number;
    education?: string; educationSchool?: string; major?: string; graduationDate?: string;
    professionalTitle?: string; professionalLevel?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new BadRequestException('用户名已存在');

    if (data.studentNumber) {
      const n = await this.prisma.user.findUnique({ where: { studentNumber: data.studentNumber } });
      if (n) throw new BadRequestException('学号已存在');
    }
    if (data.idCard) {
      const c = await this.prisma.user.findUnique({ where: { idCard: data.idCard } });
      if (c) throw new BadRequestException('身份证号已存在');
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const password = data.password || Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const passwordHash = await bcryptjs.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: data.username, displayName: data.displayName, passwordHash,
        // role 已迁移到 UserRoleAssignment，在下面分配
        studentNumber: data.studentNumber || null,
        phone: data.phone || null, email: data.email || null,
        organization: data.organization || null, batchId: data.batchId || null,
        title: data.title || null, gender: data.gender || null,
        idCard: data.idCard || null, source: data.source || null,
        remark: data.remark || null,
        feeStatus: data.feeStatus || 'UNPAID',
        enrolledAt: data.enrolledAt ? new Date(data.enrolledAt) : null,
        tags: data.tags || undefined,
        education: data.education || null,
        educationSchool: data.educationSchool || null,
        major: data.major || null,
        graduationDate: data.graduationDate ? new Date(data.graduationDate) : null,
        professionalTitle: data.professionalTitle || null,
        professionalLevel: data.professionalLevel || null,
        isActive: true,
      },
      select: USER_SELECT,
    });
    // 多角色分配
    if (data.roles && Array.isArray(data.roles)) {
      for (const roleCode of data.roles) {
        const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
        if (role) {
          await this.prisma.userRoleAssignment.upsert({
            where: { userId_roleId: { userId: user.id, roleId: role.id } },
            create: { userId: user.id, roleId: role.id },
            update: {},
          });
        }
      }
    }

    return { ...user, generatedPassword: password };
  }

  async update(id: number, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    if (data.studentNumber && data.studentNumber !== user.studentNumber) {
      const n = await this.prisma.user.findUnique({ where: { studentNumber: data.studentNumber } });
      if (n) throw new BadRequestException('学号已存在');
    }
    if (data.idCard && data.idCard !== user.idCard) {
      const c = await this.prisma.user.findUnique({ where: { idCard: data.idCard } });
      if (c) throw new BadRequestException('身份证号已存在');
    }

    const upd: any = {};
    const fields = ['displayName', 'studentNumber', 'phone', 'email', 'organization',
      'title', 'gender', 'idCard', 'source', 'remark', 'feeStatus',
      'batchId', 'isActive', 'tags',
      'education', 'educationSchool', 'major',
      'professionalTitle', 'professionalLevel'];
    for (const f of fields) {
      if (data[f] !== undefined) upd[f] = data[f];
    }
    if (data.enrolledAt !== undefined) upd.enrolledAt = data.enrolledAt ? new Date(data.enrolledAt) : null;
    if (data.graduatedAt !== undefined) upd.graduatedAt = data.graduatedAt ? new Date(data.graduatedAt) : null;
    if (data.password) upd.passwordHash = await bcryptjs.hash(data.password, 10);

    // 多角色更新
    if (data.roles && Array.isArray(data.roles)) {
      // 删除旧角色
      await this.prisma.userRoleAssignment.deleteMany({ where: { userId: id } });
      // 分配新角色
      for (const roleCode of data.roles) {
        const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
        if (role) {
          await this.prisma.userRoleAssignment.create({
            data: { userId: id, roleId: role.id },
          });
        }
      }
    }

    return this.prisma.user.update({ where: { id }, data: upd, select: USER_SELECT });
  }

  async batchCreate(students: any[]) {
    if (students.length === 0) throw new BadRequestException('请提供学员数据');
    if (students.length > 200) throw new BadRequestException('单次导入不超过200人');

    const results: { username: string; success: boolean; message: string }[] = [];
    for (const s of students) {
      try {
        await this.create(s);
        results.push({ username: s.username, success: true, message: '成功' });
      } catch (e: any) {
        results.push({ username: s.username, success: false, message: e.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    return { total: students.length, successCount, failCount: students.length - successCount, results };
  }

  /** 批量导出（CSV 简单版） */
  async exportCsv(params: { keyword?: string; groupId?: number; feeStatus?: string }) {
    const where: any = { roleAssignments: { some: { role: { code: 'STUDENT' } } } };
    if (params.keyword) {
      where.OR = [
        { displayName: { contains: params.keyword } },
        { studentNumber: { contains: params.keyword } },
        { phone: { contains: params.keyword } },
        { organization: { contains: params.keyword } },
      ];
    }
    if (params.groupId) where.batchId = params.groupId;
    if (params.feeStatus) where.feeStatus = params.feeStatus;

    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });

    const header = '学号,姓名,用户名,手机号,邮箱,单位,职务,性别,来源,缴费状态,注册日期';
    const rows = users.map(u =>
      [u.studentNumber || '', u.displayName, u.username, u.phone || '', u.email || '',
       u.organization || '', u.title || '', u.gender || '', u.source || '',
       u.feeStatus || '', u.createdAt.toISOString().slice(0, 10)].join(',')
    );
    return '﻿' + header + '\n' + rows.join('\n'); // BOM for Excel
  }

  /** 重置密码 */
  async resetPassword(id: number) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const password = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const passwordHash = await bcryptjs.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { password };
  }

  // ═══════════════════════════════
  // 批次管理（待 Phase B 完善）
  // ═══════════════════════════════

  async findAllGroups() {
    // ♻ 已从 StudentGroup 迁移到 ProgramBatch，待实现完整 API
    return this.prisma.programBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async createGroup(data: any) {
    throw new Error('createGroup 已废弃，请使用 ProgramBatch API（Phase B）');
  }

  async updateGroup(id: number, data: any) {
    throw new Error('updateGroup 已废弃，请使用 ProgramBatch API（Phase B）');
  }

  async deleteGroup(id: number) {
    throw new Error('deleteGroup 已废弃，请使用 ProgramBatch API（Phase B）');
  }
}
