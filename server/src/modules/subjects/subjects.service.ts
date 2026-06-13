import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.subject.findMany({
      include: { dictionary: true, _count: { select: { chapters: true, questions: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        dictionary: true,
        chapters: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { questions: true } },
      },
    });
    if (!subject) throw new NotFoundException(`Subject ${id} not found`);
    return subject;
  }

  async create(data: { name: string; code: string; dictionaryId: number; description?: string }) {
    return this.prisma.subject.create({ data });
  }

  async update(id: number, data: { name?: string; description?: string; sortOrder?: number }) {
    await this.findOne(id);
    return this.prisma.subject.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.subject.delete({ where: { id } });
  }
}
