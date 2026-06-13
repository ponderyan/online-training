import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DataDictionaryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.dataDictionary.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subjects: true } } },
    });
  }

  create(data: { code: string; name: string; sortOrder?: number }) {
    return this.prisma.dataDictionary.create({ data });
  }

  update(id: number, data: { name?: string; sortOrder?: number }) {
    return this.prisma.dataDictionary.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.dataDictionary.delete({ where: { id } });
  }
}
