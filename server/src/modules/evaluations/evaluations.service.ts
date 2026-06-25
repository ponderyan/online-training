import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  async create(studentId: number, data: {
    programId: number; contentRating: number; instructorRating: number;
    organizationRating?: number; overallRating: number; comment?: string;
    isAnonymous?: boolean; instructorId?: number; courseId?: number;
    instructorRatings?: { instructorId: number; rating: number }[];
  }) {
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { programId_studentId: { programId: data.programId, studentId } },
    });
    if (!enrollment) throw new ForbiddenException('您未报名该培训班');

    const program = await this.prisma.trainingProgram.findUnique({ where: { id: data.programId } });
    if (!program) throw new NotFoundException('培训班不存在');
    if (!['IN_PROGRESS', 'COMPLETED', 'REVIEWING', 'CERTIFYING'].includes(program.status)) {
      throw new BadRequestException('该培训班未开课或已取消，无法评价');
    }

    const existing = await this.prisma.evaluation.findUnique({
      where: { programId_studentId: { programId: data.programId, studentId } },
    });
    if (existing) throw new BadRequestException('您已评价过该培训班');

    if (data.instructorRatings && data.instructorRatings.length > 0) {
      const avg = Math.round(
        data.instructorRatings.reduce((s, r) => s + r.rating, 0) / data.instructorRatings.length
      );
      const evaluation = await this.prisma.evaluation.create({
        data: {
          programId: data.programId, studentId,
          contentRating: data.contentRating, instructorRating: avg,
          organizationRating: data.organizationRating ?? null,
          overallRating: data.overallRating, comment: data.comment || null,
          isAnonymous: data.isAnonymous ?? false,
          instructorId: data.instructorId ?? null, courseId: data.courseId ?? null,
        },
      });
      await this.prisma.evaluationInstructorRating.createMany({
        data: data.instructorRatings.map(r => ({
          evaluationId: evaluation.id, instructorId: r.instructorId, rating: r.rating,
        })),
      });
      return evaluation;
    }

    return this.prisma.evaluation.create({
      data: {
        programId: data.programId, studentId,
        contentRating: data.contentRating, instructorRating: data.instructorRating,
        organizationRating: data.organizationRating ?? null,
        overallRating: data.overallRating, comment: data.comment || null,
        isAnonymous: data.isAnonymous ?? false,
        instructorId: data.instructorId ?? null, courseId: data.courseId ?? null,
      },
    });
  }

  async findByProgram(programId: number) {
    return this.prisma.evaluation.findMany({
      where: { programId },
      include: {
        student: { select: { id: true, displayName: true } },
        instructorRatings: {
          include: { instructor: { select: { id: true, realName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProgramStats(programId: number) {
    const evals = await this.prisma.evaluation.findMany({
      where: { programId },
      select: { contentRating: true, instructorRating: true, organizationRating: true, overallRating: true },
    });
    if (evals.length === 0) {
      return { count: 0, contentRating: 0, instructorRating: 0, organizationRating: 0, overallRating: 0 };
    }
    const sum = (field: string) => evals.reduce((acc, e) => acc + ((e as any)[field] || 0), 0);
    const countWithOrg = evals.filter(e => e.organizationRating !== null).length;
    return {
      count: evals.length,
      contentRating: Math.round(sum('contentRating') / evals.length * 10) / 10,
      instructorRating: Math.round(sum('instructorRating') / evals.length * 10) / 10,
      organizationRating: countWithOrg > 0 ? Math.round(evals.reduce((a, e) => a + (e.organizationRating || 0), 0) / countWithOrg * 10) / 10 : 0,
      overallRating: Math.round(sum('overallRating') / evals.length * 10) / 10,
    };
  }

  async findMy(studentId: number) {
    return this.prisma.evaluation.findMany({
      where: { studentId },
      include: { program: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInstructorStats(instructorId: number) {
    const ratings = await this.prisma.evaluationInstructorRating.findMany({
      where: { instructorId },
      include: {
        evaluation: {
          select: {
            id: true, overallRating: true, comment: true, isAnonymous: true, createdAt: true,
            program: { select: { name: true } },
            student: { select: { displayName: true } },
          },
        },
      },
      orderBy: { evaluation: { createdAt: 'desc' } },
    });

    const count = ratings.length;
    const avgRating = count > 0 ? Math.round(ratings.reduce((a, r) => a + r.rating, 0) / count * 10) / 10 : 0;
    const avgOverall = count > 0 ? Math.round(ratings.reduce((a, r) => a + (r.evaluation.overallRating || 0), 0) / count * 10) / 10 : 0;

    return {
      count, instructorRating: avgRating, overallRating: avgOverall,
      evaluations: ratings.map(r => ({ ...r.evaluation, rating: r.rating })),
    };
  }

  async delete(id: number) {
    const evalRecord = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!evalRecord) throw new NotFoundException('评价不存在');
    return this.prisma.evaluation.delete({ where: { id } });
  }
}
