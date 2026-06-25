import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FilingService {
  constructor(private prisma: PrismaService) {}

  async submit(programId: number, data: { agencyName: string; agencyContact: string; agencyPhone: string }, userId: number) {
    const existing = await this.prisma.enrollmentAgencyEnrollment.findFirst({
      where: { programId, submittedById: userId },
    });
    if (existing && existing.status === 'PENDING') throw new BadRequestException('已有待审核的备案申请');
    return this.prisma.enrollmentAgencyEnrollment.create({
      data: { programId, ...data, submittedById: userId },
    });
  }

  async findAll(params: { page?: number; pageSize?: number; status?: string; search?: string }, userId?: number) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) where.agencyName = { contains: params.search };
    // 按机构隔离
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } });
      const isSuperAdmin = await this.prisma.userRoleAssignment.findFirst({
        where: { userId, role: { code: 'SUPER_ADMIN' } },
      });
      if (user?.orgId && !isSuperAdmin) {
        where.program = { orgId: user.orgId };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.enrollmentAgencyEnrollment.findMany({
        where, include: { program: { select: { name: true, code: true } }, submittedBy: { select: { displayName: true } }, reviewedBy: { select: { displayName: true } } },
        orderBy: { submittedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.enrollmentAgencyEnrollment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const filing = await this.prisma.enrollmentAgencyEnrollment.findUnique({
      where: { id },
      include: { program: true, submittedBy: { select: { displayName: true } }, reviewedBy: { select: { displayName: true } } },
    });
    if (!filing) throw new NotFoundException('备案不存在');
    return filing;
  }

  async review(id: number, data: { status: string; reviewComment?: string }, userId: number) {
    const filing = await this.prisma.enrollmentAgencyEnrollment.findUnique({ where: { id } });
    if (!filing) throw new NotFoundException('备案不存在');
    if (filing.status !== 'PENDING') throw new BadRequestException('该备案已审核');

    const result = await this.prisma.enrollmentAgencyEnrollment.update({
      where: { id },
      data: { status: data.status as any, reviewComment: data.reviewComment || null, reviewedById: userId, reviewedAt: new Date() },
    });

    // Auto-update program status when approved
    if (data.status === 'APPROVED') {
      await this.prisma.trainingProgram.update({
        where: { id: filing.programId },
        data: { status: 'ENROLLING' },
      });
    }
    return result;
  }
}
