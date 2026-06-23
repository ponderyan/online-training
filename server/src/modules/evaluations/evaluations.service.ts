import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  async create(studentId: number, data: {
    programId: number; contentRating: number; instructorRating: number;
    organizationRating?: number; overallRating: number; comment?: string;
    isAnonymous?: boolean; instructorId?: number; courseId?: number;
  }) {
    // Verify student is enrolled in the program
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { programId_studentId: { programId: data.programId, studentId } },
    });
    if (!enrollment) throw new ForbiddenException('您未报名该培训班');

    // Verify program status
    const program = await this.prisma.trainingProgram.findUnique({ where: { id: data.programId } });
    if (!program) throw new NotFoundException('培训班不存在');
    if (program.status !== 'IN_PROGRESS' && program.status !== 'COMPLETED' && program.status !== 'REVIEWING' && program.status !== 'CERTIFYING') {
      throw new BadRequestException('该培训班未开课或已取消，无法评价');
    }

    // Dedup check
    const existing = await this.prisma.evaluation.findUnique({
      where: { programId_studentId: { programId: data.programId, studentId } },
    });
    if (existing) throw new BadRequestException('您已评价过该培训班');

    return this.prisma.evaluation.create({
      data: {
        programId: data.programId,
        studentId,
        contentRating: data.contentRating,
        instructorRating: data.instructorRating,
        organizationRating: data.organizationRating ?? null,
        overallRating: data.overallRating,
        comment: data.comment || null,
        isAnonymous: data.isAnonymous ?? false,
        instructorId: data.instructorId ?? null,
        courseId: data.courseId ?? null,
      },
    });
  }

  async findByProgram(programId: number) {
    return this.prisma.evaluation.findMany({
      where: { programId },
      include: { student: { select: { id: true, displayName: true } } },
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
    const evals = await this.prisma.evaluation.findMany({
      where: { instructorId },
      select: { instructorRating: true, overallRating: true, comment: true, isAnonymous: true, createdAt: true, student: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const count = evals.length;
    const rating = count > 0 ? Math.round(evals.reduce((a, e) => a + e.instructorRating, 0) / count * 10) / 10 : 0;
    const overall = count > 0 ? Math.round(evals.reduce((a, e) => a + e.overallRating, 0) / count * 10) / 10 : 0;
    return { count, instructorRating: rating, overallRating: overall, evaluations: evals };
  }
}
