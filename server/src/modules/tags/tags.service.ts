import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({ orderBy: { id: 'asc' } });
  }

  create(data: { name: string; type: string }) {
    return this.prisma.tag.create({ data });
  }

  remove(id: number) {
    return this.prisma.tag.delete({ where: { id } });
  }
}
