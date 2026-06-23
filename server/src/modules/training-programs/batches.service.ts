import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  async findByProgram(programId: number) {
    return this.prisma.programBatch.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      include: {
        headTeacher: { select: { id: true, displayName: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(id: number) {
    const batch = await this.prisma.programBatch.findUnique({
      where: { id },
      include: {
        program: { select: { id: true, name: true } },
        headTeacher: { select: { id: true, displayName: true } },
        members: { select: { id: true, displayName: true, studentNumber: true } },
      },
    });
    if (!batch) throw new NotFoundException('批次不存在');
    return batch;
  }

  async create(programId: number, data: { name: string; headTeacherId?: number; startedAt?: string; endedAt?: string; description?: string; note?: string }) {
    // 确认培训班存在
    const program = await this.prisma.trainingProgram.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('培训班不存在');

    return this.prisma.programBatch.create({
      data: {
        name: data.name,
        programId,
        headTeacherId: data.headTeacherId || null,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        description: data.description || null,
        note: data.note || null,
      },
      include: { headTeacher: { select: { id: true, displayName: true } } },
    });
  }

  async update(id: number, data: { name?: string; headTeacherId?: number; startedAt?: string; endedAt?: string; description?: string; note?: string; isActive?: boolean }) {
    await this.findOne(id);
    const upd: any = {};
    if (data.name !== undefined) upd.name = data.name;
    if (data.headTeacherId !== undefined) upd.headTeacherId = data.headTeacherId;
    if (data.startedAt !== undefined) upd.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    if (data.endedAt !== undefined) upd.endedAt = data.endedAt ? new Date(data.endedAt) : null;
    if (data.description !== undefined) upd.description = data.description;
    if (data.note !== undefined) upd.note = data.note;
    if (data.isActive !== undefined) upd.isActive = data.isActive;
    return this.prisma.programBatch.update({ where: { id }, data: upd });
  }

  async remove(id: number) {
    await this.findOne(id);
    // 清空成员的 batchId
    await this.prisma.user.updateMany({ where: { batchId: id }, data: { batchId: null } });
    return this.prisma.programBatch.delete({ where: { id } });
  }

  async setHeadTeacher(id: number, headTeacherId: number | null) {
    await this.findOne(id);
    return this.prisma.programBatch.update({
      where: { id },
      data: { headTeacherId },
      include: { headTeacher: { select: { id: true, displayName: true } } },
    });
  }

  async getMembers(id: number) {
    await this.findOne(id);
    return this.prisma.user.findMany({
      where: { batchId: id, isActive: true },
      select: { id: true, displayName: true, studentNumber: true, phone: true, email: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async addMembers(id: number, userIds: number[]) {
    const batch = await this.findOne(id);
    // 验证所有用户存在
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
    const foundIds = users.map(u => u.id);
    const missing = userIds.filter(uid => !foundIds.includes(uid));
    if (missing.length > 0) throw new BadRequestException(`以下用户不存在: ${missing.join(',')}`);

    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { batchId: id },
    });
    return { added: userIds.length };
  }

  async removeMember(id: number, userId: number) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, batchId: id } });
    if (!user) throw new NotFoundException('该用户不在此批次中');
    await this.prisma.user.update({ where: { id: userId }, data: { batchId: null } });
    return { removed: true };
  }
}
