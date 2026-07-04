import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class KnowledgePointsService {
  constructor(private prisma: PrismaService) {}

  // 获取树形结构
  async getTree() {
    const all = await this.prisma.knowledgePoint.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(all, null);
  }

  private buildTree(nodes: any[], parentId: number | null): any[] {
    return nodes
      .filter(n => n.parentId === parentId)
      .map(n => ({ ...n, children: this.buildTree(nodes, n.id) }));
  }

  async getOne(id: number) {
    const kp = await this.prisma.knowledgePoint.findUnique({
      where: { id },
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!kp) throw new NotFoundException('知识点不存在');
    return kp;
  }

  async create(data: { name: string; code?: string; description?: string; subjectId?: number; parentId?: number; sortOrder?: number }) {
    return this.prisma.knowledgePoint.create({ data: { ...data, sortOrder: data.sortOrder || 0 } });
  }

  async update(id: number, data: { name?: string; code?: string; description?: string; subjectId?: number; parentId?: number; sortOrder?: number; isActive?: boolean }) {
    await this.getOne(id);
    return this.prisma.knowledgePoint.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.getOne(id);
    // 软删
    return this.prisma.knowledgePoint.update({ where: { id }, data: { isActive: false } });
  }

  // 题目的知识点关联
  async getQuestionKnowledgePoints(questionId: number) {
    return this.prisma.questionKnowledgePoint.findMany({
      where: { questionId },
      include: { knowledgePoint: { select: { id: true, name: true, code: true } } },
    });
  }

  async setQuestionKnowledgePoints(questionId: number, knowledgePointIds: number[]) {
    // 删除旧的关联
    await this.prisma.questionKnowledgePoint.deleteMany({ where: { questionId } });
    // 创建新的关联
    if (knowledgePointIds.length > 0) {
      await this.prisma.questionKnowledgePoint.createMany({
        data: knowledgePointIds.map(kpId => ({ questionId, knowledgePointId: kpId })),
      });
    }
    return this.getQuestionKnowledgePoints(questionId);
  }
}
