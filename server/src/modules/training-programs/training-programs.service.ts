import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TrainingProgramsService {
  constructor(private prisma: PrismaService) {}

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear().toString();
    const last = await this.prisma.trainingProgram.findFirst({
      where: { code: { startsWith: `DT-TC-${year}-` } },
      orderBy: { code: 'desc' },
    });
    let seq = 1;
    if (last) {
      const parts = last.code.split('-');
      seq = parseInt(parts[3] || '0', 10) + 1;
    }
    return `DT-TC-${year}-${String(seq).padStart(3, '0')}`;
  }

  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: string; subjectId?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
    if (params.status) where.status = params.status;
    if (params.subjectId) where.subjectId = params.subjectId;

    const [items, total] = await Promise.all([
      this.prisma.trainingProgram.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.trainingProgram.count({ where }),
    ]);

    // Get enrollment counts
    const enrollCounts = await this.prisma.programEnrollment.groupBy({
      by: ['programId'],
      _count: true,
    });
    const countMap = new Map(enrollCounts.map(e => [e.programId, e._count]));
    const subjects = await this.prisma.dataDictionary.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    return {
      items: items.map(p => ({
        ...p, enrolledCount: countMap.get(p.id) || 0, subject: subjectMap.get(p.subjectId) || null,
      })),
      total, page, pageSize, totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('培训班不存在');
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { programId: id },
      include: { agency: true },
    });
    // Get student info
    const userIds = enrollments.map(e => e.studentId);
    const users = userIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, username: true, phone: true, organization: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const subjects = await this.prisma.dataDictionary.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    return {
      ...program,
      enrolledCount: enrollments.length,
      enrollments: enrollments.map(e => ({ ...e, student: userMap.get(e.studentId) || null })),
      subject: subjectMap.get(program.subjectId) || null,
    };
  }

  async create(data: any) {
    data.code = await this.generateCode();
    if (!data.createdBy) data.createdBy = 1; // default to admin
    // 日期字段转换（前端可能传 "YYYY-MM-DD" 格式）
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.enrollStart) data.enrollStart = new Date(data.enrollStart);
    if (data.enrollEnd) data.enrollEnd = new Date(data.enrollEnd);
    return this.prisma.trainingProgram.create({ data });
  }

  async update(id: number, data: any) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    if (program.status !== 'PREPARING' && program.status !== 'ENROLLING') throw new BadRequestException('只能编辑筹备或报名中的培训班');
    const upd: any = {};
    const fields = ['name', 'courseName', 'subjectId', 'description', 'location', 'maxStudents', 'headTeacher', 'remark',
      'tuitionFee', 'examFee', 'certFee'];
    for (const f of fields) { if (data[f] !== undefined) upd[f] = data[f]; }
    if (data.startDate) upd.startDate = new Date(data.startDate);
    if (data.endDate) upd.endDate = new Date(data.endDate);
    if (data.enrollStart) upd.enrollStart = new Date(data.enrollStart);
    if (data.enrollEnd) upd.enrollEnd = new Date(data.enrollEnd);
    return this.prisma.trainingProgram.update({ where: { id }, data: upd });
  }

  async delete(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    if (program.status !== 'PREPARING') throw new BadRequestException('只能删除筹备中的培训班');
    return this.prisma.trainingProgram.delete({ where: { id } });
  }

  async updateStatus(id: number, status: string, operatorId?: number, reason?: string) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('不存在');
    const validTransitions: Record<string, string[]> = {
      PREPARING: ['ENROLLING', 'CANCELLED'], ENROLLING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['REVIEWING'], REVIEWING: ['CERTIFYING', 'PREPARING'],
      CERTIFYING: ['COMPLETED'], COMPLETED: [], CANCELLED: [],
    };
    if (!validTransitions[program.status]?.includes(status)) {
      throw new BadRequestException(`不能从 ${program.status} 转为 ${status}`);
    }
    const result = await this.prisma.trainingProgram.update({ where: { id }, data: { status: status as any } });
    // 写入状态变更日志
    await this.prisma.programStatusLog.create({
      data: { programId: id, fromStatus: program.status as any, toStatus: status as any, operatorId: operatorId || 1, reason: reason || null },
    }).catch(() => {});
    return result;
  }

  async getAvailableActions(id: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id }, select: { status: true } });
    if (!program) return [];
    const actionMap: Record<string, { label: string; target: string; confirm?: string }[]> = {
      PREPARING: [{ label: '开放报名', target: 'ENROLLING', confirm: '确认开放报名？报名开始后学员可自主报名。' }],
      ENROLLING: [{ label: '开始培训', target: 'IN_PROGRESS', confirm: '确认开始培训？开课后将锁定学员名单。' }],
      IN_PROGRESS: [{ label: '提交审核', target: 'REVIEWING', confirm: '确认提交审核？提交后等待协会审核。' }],
      REVIEWING: [
        { label: '批准发证', target: 'CERTIFYING', confirm: '确认批准发证？将触发证书批量生成。' },
        { label: '退回筹备', target: 'PREPARING', confirm: '退回到筹备阶段？退回后可修改信息重新提交。' },
      ],
      CERTIFYING: [{ label: '完成结业', target: 'COMPLETED', confirm: '确认完成结业？此操作不可逆。' }],
    };
    return actionMap[program.status] || [];
  }

  async enrollStudents(id: number, studentIds: number[], agencyId?: number) {
    const program = await this.prisma.trainingProgram.findUnique({ where: { id }, select: { status: true } });
    if (!program) throw new NotFoundException('培训班不存在');
    if (program.status !== 'ENROLLING') throw new BadRequestException('当前状态不允许报名，仅 ENROLLING 状态可报名');
    let enrolled = 0, skipped = 0;
    for (const studentId of studentIds) {
      const existing = await this.prisma.programEnrollment.findUnique({
        where: { programId_studentId: { programId: id, studentId } },
      });
      if (existing) { skipped++; continue; }
      await this.prisma.programEnrollment.create({ data: { programId: id, studentId, agencyId: agencyId || undefined } });
      enrolled++;
    }
    return { enrolled, skipped, total: enrolled + skipped };
  }
}
