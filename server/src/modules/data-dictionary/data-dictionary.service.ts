import { Injectable, BadRequestException } from '@nestjs/common';
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

  async remove(id: number) {
    // ★ 删除前检查是否有关联科目，有则拒绝（避免 FK 约束报错）
    const subjectCount = await this.prisma.subject.count({ where: { dictionaryId: id } });
    if (subjectCount > 0) {
      throw new BadRequestException(`该数据字典下还有 ${subjectCount} 个科目，无法删除。请先删除或迁移关联科目。`);
    }
    return this.prisma.dataDictionary.delete({ where: { id } });
  }
}
