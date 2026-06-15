import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    groupId?: number;
    status?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { role: 'STUDENT' };
    if (params.keyword) {
      where.OR = [
        { displayName: { contains: params.keyword } },
        { username: { contains: params.keyword } },
        { studentNumber: { contains: params.keyword } },
        { phone: { contains: params.keyword } },
        { organization: { contains: params.keyword } },
      ];
    }
    if (params.groupId) where.groupId = params.groupId;
    if (params.status === 'active') where.isActive = true;
    else if (params.status === 'inactive') where.isActive = false;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, displayName: true, role: true,
          studentNumber: true, phone: true, email: true, organization: true,
          groupId: true, isActive: true, createdAt: true,
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
    const student = await this.prisma.user.findFirst({
      where: { id, role: 'STUDENT' },
      select: {
        id: true, username: true, displayName: true, role: true,
        studentNumber: true, phone: true, email: true, organization: true,
        groupId: true, isActive: true, createdAt: true, updatedAt: true,
        group: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('学员不存在');
    return student;
  }

  async create(data: {
    username: string; displayName: string; password?: string;
    studentNumber?: string; phone?: string; email?: string;
    organization?: string; groupId?: number;
  }) {
    // 检查用户名唯一
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new BadRequestException('用户名已存在');

    if (data.studentNumber) {
      const existingNum = await this.prisma.user.findUnique({ where: { studentNumber: data.studentNumber } });
      if (existingNum) throw new BadRequestException('学号已存在');
    }

    const password = data.password || '123456';
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');

    return this.prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        passwordHash,
        role: 'STUDENT',
        studentNumber: data.studentNumber || null,
        phone: data.phone || null,
        email: data.email || null,
        organization: data.organization || null,
        groupId: data.groupId || null,
        isActive: true,
      },
      select: {
        id: true, username: true, displayName: true,
        studentNumber: true, phone: true, email: true, organization: true,
        groupId: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(id: number, data: {
    displayName?: string; studentNumber?: string; phone?: string;
    email?: string; organization?: string; groupId?: number | null;
    isActive?: boolean; password?: string;
  }) {
    const student = await this.prisma.user.findFirst({ where: { id, role: 'STUDENT' } });
    if (!student) throw new NotFoundException('学员不存在');

    if (data.studentNumber && data.studentNumber !== student.studentNumber) {
      const existing = await this.prisma.user.findUnique({ where: { studentNumber: data.studentNumber } });
      if (existing) throw new BadRequestException('学号已存在');
    }

    const updateData: any = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.studentNumber !== undefined) updateData.studentNumber = data.studentNumber;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.organization !== undefined) updateData.organization = data.organization;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = crypto.createHash('md5').update(data.password).digest('hex');
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, username: true, displayName: true,
        studentNumber: true, phone: true, email: true, organization: true,
        groupId: true, isActive: true,
      },
    });
  }

  async batchCreate(students: {
    username: string; displayName: string; password?: string;
    studentNumber?: string; phone?: string; email?: string;
    organization?: string; groupId?: number;
  }[]) {
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

  // ═══════════════════════════════
  // 分组管理
  // ═══════════════════════════════

  async findAllGroups() {
    return this.prisma.studentGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async createGroup(data: { name: string; note?: string }) {
    return this.prisma.studentGroup.create({ data });
  }

  async updateGroup(id: number, data: { name?: string; note?: string; isActive?: boolean }) {
    return this.prisma.studentGroup.update({ where: { id }, data });
  }

  async deleteGroup(id: number) {
    // 将属于该组的学员移出
    await this.prisma.user.updateMany({ where: { groupId: id }, data: { groupId: null } });
    return this.prisma.studentGroup.delete({ where: { id } });
  }
}
