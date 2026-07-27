import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { Prisma, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  private static readonly VALID_DIFFICULTIES = ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'];
  private static readonly VALID_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY'];

  constructor(
    private prisma: PrismaService,
    private systemConfig: SystemConfigService,
  ) {}

  // ═══════════════════════════════════════════
  //  权限辅助
  // ═══════════════════════════════════════════

  /**
   * 检查当前用户是否有权访问指定记录
   * @param record.orgId 记录的机构归属
   * @param userOrgId    当前用户的 orgId（SUPER_ADMIN 为 null）
   * @param userRoles    当前用户的角色列表
   */
  async canAccess(
    record: { orgId: number | null },
    userOrgId: number | null,
    userRoles: string[],
  ): Promise<boolean> {
    if (userRoles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN 可以访问系统级（orgId = null）记录
      if (record.orgId === null) return true;
      // 有归属的记录 → 取决于开关二
      const visibility = await this.systemConfig.getConfig('org_bank_visibility');
      if (visibility === 'hidden') return false;
      // view_only / full_access → 可见
      return true;
    }
    // 其他角色：必须 orgId 匹配
    return userOrgId !== null && record.orgId === userOrgId;
  }

  /**
   * 检查当前用户是否有权写入（创建/编辑/删除）指定记录
   * SUPER_ADMIN 只能写系统级记录（取决于开关二），机构角色只能写自己机构的
   */
  async canWrite(
    record: { orgId: number | null },
    userOrgId: number | null,
    userRoles: string[],
  ): Promise<boolean> {
    if (userRoles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN 可写系统级记录 + 自己机构的记录
      if (record.orgId === null) return true;
      if (userOrgId !== null && record.orgId === userOrgId) return true;
      // 其他机构记录 → 需要 full_access 配置
      const visibility = await this.systemConfig.getConfig('org_bank_visibility');
      if (visibility === 'full_access') return true;
      return false;
    }
    // 其他角色：必须 orgId 匹配
    return userOrgId !== null && record.orgId === userOrgId;
  }

  // ═══════════════════════════════════════════
  //  CRUD
  // ═══════════════════════════════════════════

  async findAll(params: {
    subjectId?: number; chapterId?: number; materialId?: number; type?: QuestionType;
    difficulty?: string; status?: string; keyword?: string;
    isPublic?: boolean; page?: number; pageSize?: number;
    createdBy?: number;
    userOrgId?: number | null;
    userRoles?: string[];
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuestionWhereInput = {};
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.chapterId) where.chapterId = params.chapterId;
    if (params.type) where.type = params.type;
    if (params.difficulty) where.difficulty = params.difficulty as any;
    if (params.status) where.status = params.status as any;
    if (params.keyword) where.content = { contains: params.keyword };
    if (params.isPublic !== undefined) where.isPublic = params.isPublic;
    if (params.createdBy !== undefined) where.createdBy = params.createdBy;

    // materialId 过滤：查 MaterialQuestion 找到关联的 questionId
    if (params.materialId) {
      const linked = await this.prisma.materialQuestion.findMany({
        where: { materialId: params.materialId, questionId: { not: null } },
        select: { questionId: true },
      });
      const ids = linked.map(l => l.questionId).filter(Boolean) as number[];
      where.id = { in: ids };
    }

    // ★ orgId 隔离
    const userOrgId = params.userOrgId ?? null;
    const userRoles = params.userRoles ?? [];
    if (userRoles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN → 取决于开关二
      const visibility = await this.systemConfig.getConfig('org_bank_visibility');
      if (visibility === 'hidden') {
        where.orgId = null;
      }  // view_only / full_access → 不限制
    } else if (userOrgId) {
      // 机构角色 → 只看自己的
      where.orgId = userOrgId;
    }
    // 没有角色（公共查询等）→ 不限制

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { name: true, code: true } },
          chapter: { select: { name: true } },
          tags: { include: { tag: true } },
          _count: { select: { paperQuestions: true } },
          materialQuestions: {
            select: {
              materialId: true,
              material: { select: { name: true } },
              chapterId: true,
              chapter: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    // 给每条记录附加来源教材/章节信息
    const enriched = items.map(q => {
      const mq = q.materialQuestions?.[0];
      return {
        ...q,
        materialQuestions: undefined,
        materialName: mq?.material?.name || null,
        materialId: mq?.materialId || null,
        chapterTitle: mq?.chapter?.title || null,
      };
    });

    return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true, code: true } },
        chapter: { select: { name: true } },
        tags: { include: { tag: true } },
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
        subQuestions: { orderBy: { sortOrder: 'asc' } },
        materialQuestions: {
          select: {
            materialId: true,
            material: { select: { name: true } },
            chapterId: true,
            chapter: { select: { title: true } },
          },
          take: 1,
        },
      },
    });
    if (!q) throw new NotFoundException(`Question ${id} not found`);

    // 权限校验
    if (userRoles && userRoles.length > 0) {
      const ok = await this.canAccess(q, userOrgId ?? null, userRoles);
      if (!ok) throw new NotFoundException(`Question ${id} not found`);
    }

    return q;
  }

  async create(data: {
    subjectId: number; chapterId: number; type: QuestionType;
    content: string; difficulty: string; isPublic?: boolean; analysis?: string;
    options?: { label: string; content: string; isCorrect: boolean }[];
    blanks?: { answer: string }[];
    subQuestions?: { content: string; answer?: string; score?: number }[];
    tagIds?: number[];
    createdBy?: number;
    orgId?: number | null;
  }) {
    const { options, blanks, subQuestions, tagIds, createdBy, orgId, ...questionData } = data;

    // ── 枚举校验 ──
    if (data.difficulty && !QuestionsService.VALID_DIFFICULTIES.includes(data.difficulty)) {
      throw new BadRequestException(`无效难度：${data.difficulty}（可选：${QuestionsService.VALID_DIFFICULTIES.join('/')}）`);
    }
    if (data.type && !QuestionsService.VALID_TYPES.includes(data.type)) {
      throw new BadRequestException(`无效题型：${data.type}（可选：${QuestionsService.VALID_TYPES.join('/')}）`);
    }

    return this.prisma.question.create({
      data: {
        ...questionData,
        createdBy,
        orgId: orgId ?? null,
        difficulty: data.difficulty as any,
        options: options ? { create: options.map((o, i) => ({ ...o, sortOrder: i })) } : undefined,
        blanks: blanks ? { create: blanks.map((b, i) => ({ ...b, blankIndex: i, sortOrder: i })) } : undefined,
        subQuestions: subQuestions ? { create: subQuestions.map((s, i) => ({ ...s, sortOrder: i })) } : undefined,
        tags: tagIds ? { create: tagIds.map(tagId => ({ tagId })) } : undefined,
      },
      include: {
        options: true, blanks: true, subQuestions: true, tags: true,
      },
    });
  }

  async update(id: number, data: {
    content?: string; difficulty?: string; analysis?: string; status?: string;
    chapterId?: number;
  }, userOrgId?: number | null, userRoles?: string[]) {
    const q = await this.findOne(id, userOrgId, userRoles);

    // 写权限校验
    if (userRoles && userRoles.length > 0) {
      const ok = await this.canWrite(q, userOrgId ?? null, userRoles);
      if (!ok) throw new ForbiddenException('无权修改此题目');
    }

    return this.prisma.question.update({ where: { id }, data: data as any });
  }

  async remove(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const q = await this.findOne(id, userOrgId, userRoles);

    // 写权限校验
    if (userRoles && userRoles.length > 0) {
      const ok = await this.canWrite(q, userOrgId ?? null, userRoles);
      if (!ok) throw new ForbiddenException('无权删除此题目');
    }

    // 引用保护：被试卷引用的试题不能删除
    const paperCount = await this.prisma.paperQuestion.count({ where: { questionId: id } });
    if (paperCount > 0) {
      throw new BadRequestException(
        `该试题已被 ${paperCount} 份试卷引用，无法删除。建议使用「停用」功能归档。`
      );
    }

    // 解除教材审核关联（如果有）
    await this.prisma.materialQuestion.updateMany({
      where: { questionId: id },
      data: { questionId: null },
    });

    return this.prisma.question.delete({ where: { id } });
  }

  async getReferencedPapers(questionId: number) {
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        paperQuestions: {
          include: {
            paper: {
              select: { id: true, name: true, paperNumber: true, status: true, totalScore: true },
            },
          },
        },
      },
    });
    if (!q) throw new NotFoundException(`Question ${questionId} not found`);
    return {
      count: q.paperQuestions.length,
      papers: q.paperQuestions.map(pq => ({
        paperId: pq.paper.id,
        name: pq.paper.name,
        paperNumber: pq.paper.paperNumber,
        status: pq.paper.status,
        score: pq.score,
        sortOrder: pq.sortOrder,
      })),
    };
  }

  // ═══════════════════════════════════════════
  //  练习模式（学员端，不加 orgId 限制）
  // ═══════════════════════════════════════════

  async getPracticeQuestions(
    count: number = 10,
    subjectId?: number,
    types?: string[],
    chapterId?: number,
  ) {
    const where: any = {
      status: 'PUBLISHED',
      practiceVisible: true,
    };
    if (subjectId) where.subjectId = subjectId;
    if (types && types.length > 0) where.type = { in: types };
    if (chapterId) where.chapterId = chapterId;

    const items = await this.prisma.question.findMany({
      where,
      take: count,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { name: true } },
        chapter: { select: { name: true } },
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
        subQuestions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    // 随机打乱
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  }

  async batchCreate(questions: any[], userOrgId?: number | null) {
    const MAX_BATCH = 300;
    if (questions.length > MAX_BATCH) {
      throw new BadRequestException(`单次最多导入 ${MAX_BATCH} 道题目，当前 ${questions.length} 道，请分批导入`);
    }

    const results: { index: number; success: boolean; id?: number; error?: string }[] = [];

    // 预加载：按 subjectId 缓存默认章节（用于 chapterId 缺失时兜底）
    const defaultChapterCache: Record<number, number | null> = {};

    for (let i = 0; i < questions.length; i++) {
      try {
        const q = questions[i];

        // ── 入参校验 ──
        if (!q.subjectId) { results.push({ index: i, success: false, error: '缺少科目ID（subjectId）' }); continue; }
        if (!q.content?.trim()) { results.push({ index: i, success: false, error: '题干不能为空' }); continue; }
        if (q.type && !QuestionsService.VALID_TYPES.includes(q.type)) {
          results.push({ index: i, success: false, error: `无效题型：${q.type}（可选：${QuestionsService.VALID_TYPES.join('/')}）` }); continue;
        }
        if (q.difficulty && !QuestionsService.VALID_DIFFICULTIES.includes(q.difficulty)) {
          results.push({ index: i, success: false, error: `无效难度：${q.difficulty}（可选：${QuestionsService.VALID_DIFFICULTIES.join('/')}）` }); continue;
        }

        // ── chapterId 兜底：缺失时取该科目下第一个章节 ──
        let chapterId = q.chapterId;
        if (!chapterId) {
          if (defaultChapterCache[q.subjectId] === undefined) {
            const firstChapter = await this.prisma.chapter.findFirst({
              where: { subjectId: q.subjectId },
              orderBy: { sortOrder: 'asc' },
              select: { id: true },
            });
            defaultChapterCache[q.subjectId] = firstChapter?.id ?? null;
          }
          chapterId = defaultChapterCache[q.subjectId];
          if (!chapterId) {
            results.push({ index: i, success: false, error: `科目 ${q.subjectId} 下无可用章节，请先创建章节` }); continue;
          }
        }

        const created = await this.prisma.question.create({
          data: {
            subjectId: q.subjectId,
            chapterId,
            type: q.type,
            content: q.content,
            difficulty: q.difficulty || 'EASY',
            source: q.source || 'BATCH_IMPORT',
            status: q.status || 'PUBLISHED',
            analysis: q.analysis || undefined,
            isPublic: q.isPublic ?? false,
            practiceVisible: q.practiceVisible ?? false,
            createdBy: q.createdBy ?? undefined,
            orgId: userOrgId ?? null,
            options: q.options ? { create: q.options.map((o: any, idx: number) => ({ ...o, sortOrder: idx })) } : undefined,
            blanks: q.blanks ? { create: q.blanks.map((b: any, idx: number) => ({ ...b, blankIndex: idx, sortOrder: idx })) } : undefined,
            subQuestions: q.subQuestions ? { create: q.subQuestions.map((s: any, idx: number) => ({ ...s, sortOrder: idx })) } : undefined,
          },
        });
        results.push({ index: i, success: true, id: created.id });
      } catch (e: any) {
        // 提取 Prisma 已知错误的关键信息，避免返回冗长堆栈
        const msg = e.meta?.cause || e.message?.split('\\n').find((l: string) => l.includes('Argument') || l.includes('Invalid')) || e.message;
        results.push({ index: i, success: false, error: msg.substring(0, 200) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return { total: questions.length, successCount, failCount: questions.length - successCount, results };
  }

  // ═══════════════════════════════════════════
  //  练习答案（学员端）
  // ═══════════════════════════════════════════

  async getPracticeAnswer(questionId?: number) {
    if (!questionId) throw new NotFoundException('题目ID不能为空');
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('题目不存在');

    const correctAnswer = this.formatCorrectAnswer(question);
    return { correctAnswer, analysis: question.analysis };
  }

  async submitPractice(data: { studentId: number; questionId: number; answer: any }) {
    const question = await this.prisma.question.findUnique({
      where: { id: data.questionId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        blanks: { orderBy: { blankIndex: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('题目不存在');

    // 1.2: 主观题(简答/案例)自评模式 — 不判对错，不计入正确率
    const isSubjective = question.type === 'SHORT_ANSWER' || question.type === 'CASE_STUDY';
    const isCorrect = isSubjective ? false : this.checkAnswer(question, data.answer);

    const record = await this.prisma.practiceRecord.upsert({
      where: {
        studentId_questionId: { studentId: data.studentId, questionId: data.questionId },
      },
      create: {
        studentId: data.studentId,
        questionId: data.questionId,
        answer: data.answer,
        isCorrect,
        subjective: isSubjective,
      },
      update: {
        answer: data.answer,
        isCorrect,
        subjective: isSubjective,
      },
    });

    const correctAnswer = this.formatCorrectAnswer(question);
    return { isCorrect, subjective: isSubjective, correctAnswer, analysis: question.analysis };
  }

  async getPracticeRecords(params: { studentId: number; onlyWrong?: boolean; subjectId?: number }) {
    const where: any = { studentId: params.studentId };
    // 1.2: 错题本不含主观题(自评题无对错)
    if (params.onlyWrong) { where.isCorrect = false; where.subjective = false; }

    const records = await this.prisma.practiceRecord.findMany({
      where,
      include: {
        question: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            blanks: { orderBy: { blankIndex: 'asc' } },
            subject: { select: { name: true } },
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let filtered = records;
    if (params.subjectId) {
      filtered = records.filter(r => r.question.subjectId === params.subjectId);
    }

    return { total: filtered.length, items: filtered };
  }

  async getPracticeStats(studentId: number) {
    const total = await this.prisma.practiceRecord.count({ where: { studentId } });
    // 1.2: 正确率仅统计客观题(主观题为自评，不计入)
    const correct = await this.prisma.practiceRecord.count({ where: { studentId, isCorrect: true, subjective: false } });
    const wrong = await this.prisma.practiceRecord.count({ where: { studentId, isCorrect: false, subjective: false } });

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT q.subject_id, ANY_VALUE(s.name) as subject_name,
        COUNT(*) as total,
        SUM(CASE WHEN pr.is_correct THEN 1 ELSE 0 END) as correct
      FROM practice_records pr
      JOIN questions q ON q.id = pr.question_id
      JOIN subjects s ON s.id = q.subject_id
      WHERE pr.student_id = ?
      GROUP BY q.subject_id
    `, studentId);

    const bySubject = rows.map((r: any) => ({
      subject_id: Number(r.subject_id),
      subject_name: r.subject_name,
      total: Number(r.total),
      correct: Number(r.correct),
    }));

    return {
      total,
      correct,
      wrong,
      accuracy: (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0,
      bySubject,
    };
  }

  async toggleFavorite(studentId: number, questionId: number) {
    const existing = await this.prisma.questionFavorite.findUnique({
      where: { studentId_questionId: { studentId, questionId } },
    });
    if (existing) {
      await this.prisma.questionFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.questionFavorite.create({ data: { studentId, questionId } });
    return { favorited: true };
  }

  async getFavoriteQuestions(params: { studentId: number; subjectId?: number }) {
    const where: any = { studentId: params.studentId };
    const records = await this.prisma.questionFavorite.findMany({
      where,
      include: {
        question: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            blanks: { orderBy: { blankIndex: 'asc' } },
            subject: { select: { name: true } },
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    let items = records.map(r => r.question);
    if (params.subjectId) items = items.filter(q => q.subjectId === params.subjectId);
    return { total: items.length, items };
  }

  async getFavoriteIds(studentId: number) {
    const records = await this.prisma.questionFavorite.findMany({
      where: { studentId },
      select: { questionId: true },
    });
    return records.map(r => r.questionId);
  }

  private checkAnswer(question: any, studentAnswer: any): boolean {
    switch (question.type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE': {
        const correct = question.options?.find((o: any) => o.isCorrect);
        return studentAnswer === correct?.label;
      }
      case 'MULTIPLE_CHOICE': {
        const correctLabels = new Set(
          question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label)
        );
        const studentLabels = new Set(Array.isArray(studentAnswer) ? studentAnswer : []);
        if (correctLabels.size !== studentLabels.size) return false;
        for (const l of correctLabels) if (!studentLabels.has(l)) return false;
        return true;
      }
      case 'FILL_BLANK': {
        const blanks = question.blanks || [];
        const studentBlanks = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        if (blanks.length !== studentBlanks.length) return false;
        return blanks.every((b: any, i: number) =>
          String(studentBlanks[i] || '').trim().toLowerCase() === String(b.answer || '').trim().toLowerCase()
        );
      }
      case 'SHORT_ANSWER':
      case 'CASE_STUDY':
        return false;
      default:
        return false;
    }
  }

  async getPracticeTrend(studentId: number, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 一次查询所有记录 + 关联的知识点
    const records = await this.prisma.practiceRecord.findMany({
      where: { studentId, createdAt: { gte: startDate } },
      select: { createdAt: true, isCorrect: true, questionId: true },
      orderBy: { createdAt: 'asc' },
    });

    // 收集所有 questionId，批量查知识点关联
    const qIds = [...new Set(records.map(r => r.questionId))];
    const qkps = qIds.length > 0
      ? await this.prisma.questionKnowledgePoint.findMany({
          where: { questionId: { in: qIds } },
          include: { knowledgePoint: { select: { id: true, name: true } } },
        })
      : [];

    // questionId → knowledgePoints map
    const qKpMap = new Map<number, { kpId: number; kpName: string }[]>();
    for (const qkp of qkps) {
      const existing = qKpMap.get(qkp.questionId) || [];
      existing.push({ kpId: qkp.knowledgePointId, kpName: qkp.knowledgePoint.name });
      qKpMap.set(qkp.questionId, existing);
    }

    // 按天分组
    const dayMap = new Map<string, { total: number; correct: number; kpStats: Map<number, { kpName: string; total: number; correct: number }> }>();

    for (const r of records) {
      const dateKey = r.createdAt.toISOString().slice(0, 10);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { total: 0, correct: 0, kpStats: new Map() });
      }
      const day = dayMap.get(dateKey)!;
      day.total++;
      if (r.isCorrect) day.correct++;

      // 知识点统计
      const kps = qKpMap.get(r.questionId) || [];
      for (const kp of kps) {
        if (!day.kpStats.has(kp.kpId)) {
          day.kpStats.set(kp.kpId, { kpName: kp.kpName, total: 0, correct: 0 });
        }
        const ks = day.kpStats.get(kp.kpId)!;
        ks.total++;
        if (r.isCorrect) ks.correct++;
      }
    }

    // 构建返回
    const result: any[] = [];
    for (const [date, day] of dayMap) {
      const kpAccuracy: any[] = [];
      for (const [kpId, ks] of day.kpStats) {
        kpAccuracy.push({
          kpId,
          kpName: ks.kpName,
          total: ks.total,
          correct: ks.correct,
          accuracy: ks.total > 0 ? Math.round((ks.correct / ks.total) * 1000) / 10 : 0,
        });
      }
      result.push({
        date,
        total: day.total,
        correct: day.correct,
        accuracy: day.total > 0 ? Math.round((day.correct / day.total) * 1000) / 10 : 0,
        kpAccuracy,
      });
    }

    return result;
  }

  private formatCorrectAnswer(question: any): string {
    switch (question.type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE':
        return question.options?.find((o: any) => o.isCorrect)?.label || '—';
      case 'MULTIPLE_CHOICE':
        return question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join(', ') || '—';
      case 'FILL_BLANK':
        return question.blanks?.map((b: any) => b.answer).join(' | ') || '—';
      case 'SHORT_ANSWER':
      case 'CASE_STUDY':
        return (question as any).analysis || '参考答案见解析';
      default:
        return '—';
    }
  }

  /**
   * P2-1: 错题 → 知识块 → 教材回顾
   * 链路：Question → QuestionKnowledgePoint → ChunkKnowledgePoint → KnowledgeChunk
   */
  async getRelatedKnowledgeChunks(questionId: number) {
    // 找到题目关联的知识点
    const qkps = await this.prisma.questionKnowledgePoint.findMany({
      where: { questionId },
      select: { knowledgePointId: true },
    });
    if (qkps.length === 0) return { chunks: [], knowledgePoints: [] };

    const kpIds = qkps.map(q => q.knowledgePointId);

    // 通过 ChunkKnowledgePoint 找到关联的知识块
    const chunkKps = await this.prisma.chunkKnowledgePoint.findMany({
      where: { knowledgePointId: { in: kpIds } },
      include: {
        chunk: {
          select: { id: true, content: true, title: true, source: true, documentId: true },
        },
        knowledgePoint: { select: { id: true, name: true } },
      },
      orderBy: { confidence: 'desc' },
      take: 10,
    });

    // 获取文档名
    const docIds = [...new Set(chunkKps.map(c => c.chunk.documentId).filter(Boolean))] as number[];
    const docs = docIds.length > 0
      ? await this.prisma.knowledgeDocument.findMany({ where: { id: { in: docIds } }, select: { id: true, name: true } })
      : [];
    const docMap = new Map(docs.map(d => [d.id, d.name]));

    const chunks = chunkKps.map(ckp => ({
      id: ckp.chunk.id,
      content: (ckp.chunk.content || '').slice(0, 400),
      title: ckp.chunk.title,
      source: ckp.chunk.source,
      documentName: ckp.chunk.documentId ? (docMap.get(ckp.chunk.documentId) || ckp.chunk.title) : ckp.chunk.title,
      knowledgePoint: ckp.knowledgePoint.name,
      confidence: ckp.confidence,
    }));

    const knowledgePoints = [...new Set(chunkKps.map(c => c.knowledgePoint.name))];

    return { chunks, knowledgePoints };
  }
}
