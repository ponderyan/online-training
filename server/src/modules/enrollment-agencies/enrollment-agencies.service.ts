import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EnrollmentAgenciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; keyword?: string }) {
    const page = params.page || 1;
    const where: any = {};
    if (params.keyword) where.name = { contains: params.keyword };
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
}