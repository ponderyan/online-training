import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ChaptersService {
  constructor(private prisma: PrismaService) {}

  async findBySubject(subjectId: number) {
    return this.prisma.chapter.findMany({
      where: { subjectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: number) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id } });
    if (!chapter) throw new NotFoundException(`Chapter ${id} not found`);
    return chapter;
  }

  async create(data: { subjectId: number; name: string; sortOrder?: number }) {
    return this.prisma.chapter.create({ data });
  }

  async update(id: number, data: { name?: string; sortOrder?: number }) {
    await this.findOne(id);
    return this.prisma.chapter.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chapter.delete({ where: { id } });
  }
}
