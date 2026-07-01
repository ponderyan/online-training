import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { Prisma, Difficulty, QuestionType, PaperStatus } from '@prisma/client';
import { join } from 'path';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { execSync } from 'child_process';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, PageNumber,
  Footer, Header, PageBreak, ShadingType, convertMillimetersToTwip,
  TabStopPosition, TabStopType, NumberFormat,
  ExternalHyperlink, LevelFormat,
} from 'docx';

@Injectable()
export class PapersService {
  constructor(
    private prisma: PrismaService,
    private systemConfig: SystemConfigService,
  ) {}

  async findAll(params: { page?: number; pageSize?: number; userOrgId?: number | null; userRoles?: string[] }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    // ★ orgId 隔离
    const where: any = {};
    const userOrgId = params.userOrgId ?? null;
    const userRoles = params.userRoles ?? [];
    if (userRoles.includes('SUPER_ADMIN')) {
      const visibility = await this.systemConfig.getConfig('org_bank_visibility');
      if (visibility === 'hidden') where.orgId = null;
    } else if (userOrgId) {
      where.orgId = userOrgId;
    }

    const [items, total] = await Promise.all([
      this.prisma.paper.findMany({
        where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { name: true, code: true } },
          creator: { select: { displayName: true } },
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.paper.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const paper = await this.prisma.paper.findUnique({
      where: { id },
      include: {
        subject: { select: { name: true, code: true } },
        creator: { select: { displayName: true } },
        template: { select: { name: true } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { sortOrder: 'asc' } },
                blanks: { orderBy: { blankIndex: 'asc' } },
                subQuestions: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!paper) throw new NotFoundException(`Paper ${id} not found`);

    // ★ orgId 隔离：非 SUPER_ADMIN 只能访问自己机构的
    if (userRoles && userRoles.length > 0 && !userRoles.includes('SUPER_ADMIN')) {
      const uOrgId = userOrgId ?? null;
      if (uOrgId === null || paper.orgId !== uOrgId) {
        throw new NotFoundException(`Paper ${id} not found`);
      }
    }

    return paper;
  }

  async create(data: {
    name: string; subjectId: number; createdBy: number;
    totalScore?: number; durationMinutes?: number;
    orgId?: number | null;
  }) {
    if (!data.name || !data.subjectId || !data.createdBy) {
      throw new BadRequestException('缺少必要参数：name, subjectId, createdBy');
    }
    const subject = await this.prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) throw new NotFoundException('科目不存在');

    const seq = subject.paperNumberSeq;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const paperNumber = `DT+${subject.code}-${dateStr}-${String(seq).padStart(3, '0')}`;

    await this.prisma.subject.update({
      where: { id: data.subjectId },
      data: { paperNumberSeq: seq + 1 },
    });

    return this.prisma.paper.create({
      data: {
        name: data.name,
        paperNumber,
        subjectId: data.subjectId,
        totalScore: data.totalScore || 100,
        durationMinutes: data.durationMinutes || 90,
        status: 'DRAFT',
        createdBy: data.createdBy,
        orgId: data.orgId ?? null,
      },
    });
  }

  async generate(data: {
    name?: string; subjectId: number; createdBy: number;
    orgId?: number | null;
    totalScore?: number; durationMinutes?: number; isOpenBook?: boolean;
    templateId?: number; // 快捷路径：用模板配置生成
    typeConfigs?: { questionType: QuestionType; count: number; scorePerQuestion: number }[];
    difficultyDistribution?: Record<string, number>;
    chapterStrategy?: string; sourceMix?: number;
    excludeQuestionIds?: number[];
    includeQuestionIds?: number[]; // 必选题
  }) {
    // ═══════════════════════════════════════════
    //  快捷路径：如果有 templateId，自动加载模板配置
    // ═══════════════════════════════════════════
    if (data.templateId) {
      const template = await this.prisma.paperTemplate.findUnique({
        where: { id: data.templateId },
        include: { typeConfigs: true },
      });
      if (!template) throw new NotFoundException('模板不存在');

      data.typeConfigs = template.typeConfigs.map(tc => ({
        questionType: tc.questionType,
        count: tc.count,
        scorePerQuestion: tc.scorePerQuestion,
      }));
      data.difficultyDistribution = template.difficultyDistribution as Record<string, number>;
      data.chapterStrategy = data.chapterStrategy || template.chapterStrategy;
      data.sourceMix = data.sourceMix ?? template.sourceMix;
      data.totalScore = data.totalScore ?? template.totalScore;
      data.durationMinutes = data.durationMinutes ?? template.durationMinutes;
      data.isOpenBook = data.isOpenBook ?? template.isOpenBook;
      data.name = data.name || template.name;
    }

    if (!data.name || !data.totalScore || !data.typeConfigs) {
      throw new BadRequestException('缺少必要参数：name, totalScore, typeConfigs（或提供 templateId）');
    }
    data.difficultyDistribution = data.difficultyDistribution ?? { EASY: 25, MEDIUM_EASY: 25, MEDIUM_HARD: 25, HARD: 25 };
    const subject = await this.prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');

    const seq = subject.paperNumberSeq;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const paperNumber = `DT+${subject.code}-${dateStr}-${String(seq).padStart(3, '0')}`;

    await this.prisma.subject.update({
      where: { id: data.subjectId },
      data: { paperNumberSeq: seq + 1 },
    });

    const selectedQuestions: { questionId: number; score: number; typeSection: string }[] = [];
    let sortOrder = 0;

    const totalScore = data.totalScore;

    // ── 处理必选题 ──
    const includeIds = data.includeQuestionIds || [];
    if (includeIds.length > 0) {
      const included = await this.prisma.question.findMany({
        where: { id: { in: includeIds }, subjectId: data.subjectId, status: 'PUBLISHED' },
        select: { id: true, type: true },
      });
      for (const q of included) {
        // 按题型找对应的 typeConfig
        const tc = data.typeConfigs.find(t => t.questionType === q.type);
        if (tc) {
          selectedQuestions.push({
            questionId: q.id,
            score: tc.scorePerQuestion,
            typeSection: q.type,
          });
        }
      }
    }

    let subtotalCheck = 0;

    // 统计已选的必选题数（按题型）
    const selectedByType: Record<string, number> = {};
    for (const sq of selectedQuestions) {
      selectedByType[sq.typeSection] = (selectedByType[sq.typeSection] || 0) + 1;
    }

    for (const tc of data.typeConfigs) {
      subtotalCheck += tc.count * tc.scorePerQuestion;
      if (tc.count === 0) continue;

      // 减去该题型已选的必选题
      const alreadyCount = selectedByType[tc.questionType] || 0;
      const remaining = Math.max(0, tc.count - alreadyCount);
      if (remaining === 0) continue;

      const difficultyMap = data.difficultyDistribution;
      let countPerDifficulty: Record<string, number>;
      if (Object.keys(difficultyMap).length > 0) {
        const totalWeight = Object.values(difficultyMap).reduce((a, b) => a + b, 0);
        countPerDifficulty = {};
        let allocated = 0;
        for (const [diff, weight] of Object.entries(difficultyMap)) {
          const c = Math.round((weight / totalWeight) * remaining);
          countPerDifficulty[diff] = c;
          allocated += c;
        }
        const diffs = Object.keys(difficultyMap);
        for (let i = 0; allocated < remaining && i < diffs.length; i++) {
          countPerDifficulty[diffs[i]]++;
          allocated++;
        }
      } else {
        countPerDifficulty = { EASY: remaining };
      }

      // 收集该题型所有可用试题（不限难度）
      const allExcludeIds = [...(data.excludeQuestionIds || []), ...includeIds];
      let totalFetched = 0;

      for (const [difficulty, count] of Object.entries(countPerDifficulty)) {
        if (count <= 0) continue;

        const where: Prisma.QuestionWhereInput = {
          subjectId: data.subjectId,
          type: tc.questionType,
          difficulty: difficulty as Difficulty,
          status: 'PUBLISHED',
          ...(data.sourceMix && data.sourceMix < 100
            ? { OR: [{ isPublic: true }, { subjectId: data.subjectId }] }
            : { subjectId: data.subjectId }
          ),
          ...(allExcludeIds.length ? { id: { notIn: allExcludeIds } } : {}),
        };

        const available = await this.prisma.question.findMany({
          where, select: { id: true }, take: count * 3,
        });

        const shuffled = available.sort(() => Math.random() - 0.5).slice(0, count);
        for (const q of shuffled) {
          selectedQuestions.push({
            questionId: q.id, score: tc.scorePerQuestion,
            typeSection: tc.questionType,
          });
        }
        totalFetched += shuffled.length;
      }

      // 如果按难度分配后还有缺口（该难度没有足够试题），从该题型其他难度补足
      if (totalFetched < remaining) {
        const shortfall = remaining - totalFetched;
        const fallbackWhere: Prisma.QuestionWhereInput = {
          subjectId: data.subjectId,
          type: tc.questionType,
          status: 'PUBLISHED',
          ...(data.sourceMix && data.sourceMix < 100
            ? { OR: [{ isPublic: true }, { subjectId: data.subjectId }] }
            : { subjectId: data.subjectId }
          ),
          id: { notIn: [...allExcludeIds, ...selectedQuestions.map(sq => sq.questionId)] },
        };
        const fallback = await this.prisma.question.findMany({
          where: fallbackWhere, select: { id: true }, take: shortfall * 2,
        });
        for (const q of fallback.sort(() => Math.random() - 0.5).slice(0, shortfall)) {
          selectedQuestions.push({
            questionId: q.id, score: tc.scorePerQuestion,
            typeSection: tc.questionType,
          });
        }
      }
    }

    if (subtotalCheck !== totalScore) {
      throw new BadRequestException(`题型分值合计(${subtotalCheck})与总分(${totalScore})不一致`);
    }

    const paper = await this.prisma.paper.create({
      data: {
        name: data.name,
        paperNumber,
        subjectId: data.subjectId,
        totalScore,
        durationMinutes: data.durationMinutes ?? 90,
        isOpenBook: data.isOpenBook ?? false,
        status: 'DRAFT',
        createdBy: data.createdBy,
        orgId: data.orgId ?? null,
        questions: {
          create: selectedQuestions.map((sq) => ({
            questionId: sq.questionId,
            score: sq.score,
            sortOrder: sortOrder++,
            typeSection: sq.typeSection,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { sortOrder: 'asc' } },
                blanks: { orderBy: { blankIndex: 'asc' } },
                subQuestions: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });

    await this.prisma.coolDownRecord.createMany({
      data: selectedQuestions.map(sq => ({
        questionId: sq.questionId,
        paperId: paper.id,
      })),
    });

    for (const sq of selectedQuestions) {
      await this.prisma.question.update({
        where: { id: sq.questionId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return paper;
  }

  async finalize(id: number) {
    const paper = await this.findOne(id);
    if (paper.status !== 'DRAFT') throw new BadRequestException('Only draft papers can be finalized');

    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: id },
      include: {
        question: {
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            blanks: { orderBy: { blankIndex: 'asc' } },
            subQuestions: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    for (const pq of paperQuestions) {
      await this.prisma.paperQuestion.update({
        where: { id: pq.id },
        data: {
          snapshot: {
            content: pq.question.content,
            analysis: pq.question.analysis,
            type: pq.question.type,
            options: pq.question.options,
            blanks: pq.question.blanks,
            subQuestions: pq.question.subQuestions,
          },
        },
      });
    }

    return this.prisma.paper.update({
      where: { id },
      data: { status: 'FINALIZED', finalizedAt: new Date() },
    });
  }

  async promoteToOfficial(id: number) {
    const paper = await this.findOne(id);
    if (paper.status !== 'FINALIZED') throw new BadRequestException('Only finalized papers can be promoted to official');
    return this.prisma.paper.update({
      where: { id },
      data: { status: 'OFFICIAL' },
    });
  }

  async uploadWord(id: number, file: Express.Multer.File) {
    const paper = await this.findOne(id);
    if (paper.status === 'DRAFT') throw new BadRequestException('Draft papers cannot generate PDF');

    const uploadDir = join('/var/www/exam-system', 'paper-files', String(id));
    await mkdir(uploadDir, { recursive: true });

    const docxPath = join(uploadDir, 'edited.docx');
    await writeFile(docxPath, file.buffer);

    try {
      execSync(`soffice --headless --convert-to pdf --outdir ${uploadDir} ${docxPath}`, {
        timeout: 30000,
      });
    } catch {
      throw new BadRequestException('PDF conversion failed. Check that LibreOffice is installed and the Word file is valid.');
    }

    const pdfPath = join(uploadDir, 'edited.pdf');
    return { message: 'PDF 生成成功', pdfUrl: `/paper-files/${id}/edited.pdf` };
  }

  async remove(id: number, userOrgId?: number | null, userRoles?: string[]) {
    const paper = await this.findOne(id, userOrgId, userRoles);
    // 非 SUPER_ADMIN 只能删自己机构的
    if (userRoles && userRoles.length > 0 && !userRoles.includes('SUPER_ADMIN')) {
      const uOrgId = userOrgId ?? null;
      if (uOrgId === null || paper.orgId !== uOrgId) {
        throw new NotFoundException(`Paper ${id} not found`);
      }
    }
    return this.prisma.paper.delete({ where: { id } });
  }

  async removeQuestion(paperId: number, pqId: number) {
    const pq = await this.prisma.paperQuestion.findUnique({ where: { id: pqId } });
    if (!pq || pq.paperId !== paperId) throw new NotFoundException('试卷试题不存在');
    await this.prisma.paperQuestion.delete({ where: { id: pqId } });
    return { success: true };
  }

  async addQuestion(paperId: number, data: { questionId: number; score: number; typeSection: string }) {
    const paper = await this.findOne(paperId);
    if (paper.status !== 'DRAFT') throw new BadRequestException('仅草稿试卷可编辑');

    // 获取当前最大序号
    const maxSort = await this.prisma.paperQuestion.aggregate({
      where: { paperId },
      _max: { sortOrder: true },
    });

    const pq = await this.prisma.paperQuestion.create({
      data: {
        paperId,
        questionId: data.questionId,
        score: data.score,
        typeSection: data.typeSection,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    await this.prisma.question.update({
      where: { id: data.questionId },
      data: { usageCount: { increment: 1 } },
    });

    return this.findOne(paperId);
  }

  async replaceQuestion(paperId: number, pqId: number, newQuestionId: number) {
    const pq = await this.prisma.paperQuestion.findUnique({ where: { id: pqId } });
    if (!pq || pq.paperId !== paperId) throw new NotFoundException('试卷试题不存在');

    const paper = await this.findOne(paperId);
    if (paper.status !== 'DRAFT') throw new BadRequestException('仅草稿试卷可编辑');

    await this.prisma.paperQuestion.update({
      where: { id: pqId },
      data: { questionId: newQuestionId },
    });

    return this.findOne(paperId);
  }

  async generateExportHtml(id: number): Promise<string> {
    const paper = await this.findOne(id);
    const groups = this.groupQuestions(paper);
    let qNum = 0;

    let bodyHtml = '';
    for (const [, group] of Object.entries(groups)) {
      bodyHtml += `<div class="section-title">${group.label}</div>`;
      for (const pq of group.items) {
        qNum++;
        const q = pq.question;
        let content = q.content || '';
        if (group.section === 'FILL_BLANK') content = content.replace(/\{\{_\}\}/g, '（　）');
        const options = q.options?.length
          ? '<div class="opts">' + q.options.map((o: any) => `<div><b>${o.label}.</b> ${o.content}</div>`).join('') + '</div>'
          : '';
        const subs = q.subQuestions?.length
          ? '<div class="subs">' + q.subQuestions.map((sq: any, i: number) => `<div>(${i + 1}) ${sq.content}</div>`).join('') + '</div>'
          : '';
        bodyHtml += `<div class="q"><b>${qNum}.</b> ${content}${options}${subs}</div>`;
      }
    }

    return `<html><body style="font-family:SimSun;font-size:12pt;margin:2.5cm 2cm">
      <h2 style="text-align:center">${paper.name}${paper.isOpenBook ? '（开卷）' : ''}</h2>
      <p style="text-align:center;font-size:10pt">（考试时长：${paper.durationMinutes || '—'}分钟，满分${paper.totalScore}分）</p>
      <table border="1" style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:20px">
        <tr><td style="width:100px;text-align:center;background:#f5f5f5;font-weight:bold">考试科目</td><td>${paper.subject?.name || '—'}</td><td style="width:80px;text-align:center;background:#f5f5f5;font-weight:bold">试卷满分</td><td style="width:80px;text-align:center">${paper.totalScore}分</td></tr>
        <tr><td style="text-align:center;background:#f5f5f5;font-weight:bold">考试时间</td><td>${paper.durationMinutes || '—'}分钟</td><td style="text-align:center;background:#f5f5f5;font-weight:bold">考试形式</td><td style="text-align:center">${paper.isOpenBook ? '开卷' : '闭卷'}</td></tr>
      </table>
      ${bodyHtml}
      <div style="text-align:center;font-size:9pt;font-weight:bold;color:#c00;margin-top:30px">内部资料 严禁拍照 严禁带走 违者必究</div>
      <p style="text-align:center;font-size:9pt;color:#888">${paper.paperNumber || ''}</p>
    </body></html>`;
  }

  private groupQuestions(paper: any) {
    const typeNames: Record<string, string> = {
      SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
      FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
    };
    const groups: Record<string, { section: string; label: string; items: any[]; totalScore: number; scorePerQ: number }> = {};
    for (const pq of paper.questions || []) {
      const section = pq.typeSection || 'Other';
      if (!groups[section]) {
        groups[section] = { section, label: '', items: [], totalScore: 0, scorePerQ: pq.score };
      }
      groups[section].items.push(pq);
      groups[section].totalScore += pq.score;
    }
    for (const [, g] of Object.entries(groups)) {
      const name = typeNames[g.section] || g.section;
      g.label = `${name}（每题${g.scorePerQ}分、共${g.totalScore}分）`;
    }
    return groups;
  }

  async generateExportPdf(id: number): Promise<any> {
    const html = await this.generateExportHtml(id);
    const tmpDir = join('/tmp', 'paper-pdf-' + id + '-' + Date.now());
    await mkdir(tmpDir, { recursive: true });
    const htmlPath = join(tmpDir, 'paper.html');
    const pdfPath = join(tmpDir, 'paper.pdf');
    await writeFile(htmlPath, html, 'utf-8');
    try {
      execSync('soffice --headless --convert-to pdf --outdir ' + tmpDir + ' ' + htmlPath, { timeout: 30000 });
      return await readFile(pdfPath);
    } finally {
      execSync('rm -rf ' + tmpDir, { timeout: 5000 });
    }
  }

  async generateExportDocx(id: number): Promise<Buffer> {
    const paper = await this.findOne(id);
    const groups = this.groupQuestions(paper);

    // Helper: create a paragraph with specific formatting
    const p = (text: string, opts?: { bold?: boolean; size?: number; align?: 'center' | 'left' | 'right'; space?: number; spacing?: { before?: number; after?: number } }) => {
      const alignmentMap = { center: AlignmentType.CENTER, left: AlignmentType.LEFT, right: AlignmentType.RIGHT };
      return new Paragraph({
        alignment: opts?.align ? alignmentMap[opts.align] : AlignmentType.LEFT,
        spacing: { before: opts?.spacing?.before ?? 0, after: opts?.spacing?.after ?? 0, line: 360 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            size: (opts?.size || 12) * 2, // half-points
            font: { name: 'SimSun', eastAsia: 'SimSun' },
          }),
        ],
      });
    };

    // Helper: create empty TODO paragraph for blanks
    const blankLine = () => p('______', { size: 11, spacing: { before: 40 } });

    const children: (Paragraph | Table)[] = [];

    // === Title (matching real DTM template) ===
    children.push(p(`${paper.name}${paper.isOpenBook ? '（开卷）' : ''}`, { size: 16, bold: true, align: 'center', spacing: { after: 40 } }));
    children.push(p(`（考试时长：${paper.durationMinutes || '—'}分钟，满分${paper.totalScore}分）`, { size: 10, align: 'center', spacing: { after: 120 } }));

    // === Info Table ===
    const cellOpts = (text: string, opts?: { bold?: boolean; bg?: string; width?: number }) => ({
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts?.bold, size: 20, font: { name: 'SimSun', eastAsia: 'SimSun' } })] })],
      width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      shading: opts?.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
    });

    children.push(new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell(cellOpts('考试科目', { bold: true, bg: 'F5F5F5', width: 1800 })),
            new TableCell(cellOpts(paper.subject?.name || '—', { width: 3400 })),
            new TableCell(cellOpts('试卷满分', { bold: true, bg: 'F5F5F5', width: 1400 })),
            new TableCell(cellOpts(`${paper.totalScore} 分`, { width: 1400 })),
          ],
        }),
        new TableRow({
          children: [
            new TableCell(cellOpts('考试时间', { bold: true, bg: 'F5F5F5', width: 1800 })),
            new TableCell(cellOpts(`${paper.durationMinutes || '—'} 分钟`, { width: 3400 })),
            new TableCell(cellOpts('考试形式', { bold: true, bg: 'F5F5F5', width: 1400 })),
            new TableCell(cellOpts(paper.isOpenBook ? '开卷' : '闭卷', { width: 1400 })),
          ],
        }),
        new TableRow({
          children: [
            new TableCell(cellOpts('试卷编号', { bold: true, bg: 'F5F5F5', width: 1800 })),
            new TableCell(cellOpts(paper.paperNumber || '—', { width: 3400 })),
            new TableCell(cellOpts('', { width: 1400 })),
            new TableCell(cellOpts('', { width: 1400 })),
          ],
        }),
      ],
    }));

    children.push(p('', { spacing: { after: 160 } })); // spacer

    // === Questions by section ===
    let qNum = 0;
    const boldRun = (text: string, size = 12) => new TextRun({ text, bold: true, size: size * 2, font: { name: 'SimSun', eastAsia: 'SimSun' } });
    const run = (text: string, size = 12) => new TextRun({ text, size: size * 2, font: { name: 'SimSun', eastAsia: 'SimSun' } });

    for (const [, group] of Object.entries(groups)) {
      // Section header
      children.push(p(group.label, { size: 11, bold: true, spacing: { before: 200, after: 100 } }));

      for (const pq of group.items) {
        qNum++;
        const q = pq.question;
        if (!q) continue;

        // Question line: "1. content (  )"
        const qChildren: TextRun[] = [
          boldRun(`${qNum}. `),
        ];

        if (group.section === 'FILL_BLANK') {
          const blanked = (q.content || '').replace(/\{\{_\}\}/g, '（　）');
          qChildren.push(run(blanked));
        } else if (group.section === 'SINGLE_CHOICE' || group.section === 'MULTIPLE_CHOICE') {
          qChildren.push(run(q.content || ''));
          qChildren.push(run('（    ）'));
        } else if (group.section === 'TRUE_FALSE') {
          qChildren.push(run(q.content || ''));
          qChildren.push(run('（    ）'));
        } else {
          qChildren.push(run(q.content || ''));
        }

        if (group.section === 'CASE_STUDY') {
          qChildren.push(run(`（${pq.score}分）`, 10));
        }

        children.push(new Paragraph({
          spacing: { before: 80, after: 40, line: 360 },
          children: qChildren,
        }));

        // Options (for choice types)
        if (q.options?.length) {
          for (const o of q.options) {
            children.push(new Paragraph({
              spacing: { before: 20, after: 20, line: 340 },
              indent: { left: 400 },
              children: [
                boldRun(`${o.label}. `, 11),
                run(o.content, 11),
              ],
            }));
          }
        }

        // Sub-questions (for case study)
        if (q.subQuestions?.length) {
          for (let i = 0; i < q.subQuestions.length; i++) {
            const sq = q.subQuestions[i];
            children.push(new Paragraph({
              spacing: { before: 40, after: 20, line: 340 },
              indent: { left: 400 },
              children: [run(`（${i + 1}）${sq.content || ''}`, 11)],
            }));
          }
        }
      }
    }

    // === Footer / Disclaimer ===
    children.push(p('', { spacing: { before: 400 } }));
    children.push(p('内部资料 严禁拍照 严禁带走 违者必究', { size: 9, bold: true, align: 'center', spacing: { before: 200 } }));
    children.push(p(paper.paperNumber || '', { size: 9, align: 'center' }));

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'SimSun', size: 24 },
            paragraph: { spacing: { line: 360 } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children,
      }],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  // ═══════════════════════════════════════════════
  //  答题卡生成
  // ═══════════════════════════════════════════════

  async generateAnswerSheetDocx(id: number): Promise<Buffer> {
    const paper = await this.findOne(id);
    const groups = this.groupQuestions(paper);
    const typeOrder = ['SINGLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY'];

    // Helper functions
    const p = (text: string, opts?: { bold?: boolean; size?: number; align?: 'center' | 'left' | 'right'; space?: number; spacing?: { before?: number; after?: number } }) => {
      const alignmentMap = { center: AlignmentType.CENTER, left: AlignmentType.LEFT, right: AlignmentType.RIGHT };
      return new Paragraph({
        alignment: opts?.align ? alignmentMap[opts.align] : AlignmentType.LEFT,
        spacing: { before: opts?.spacing?.before ?? 0, after: opts?.spacing?.after ?? 0, line: 360 },
        children: [
          new TextRun({
            text, bold: opts?.bold,
            size: (opts?.size || 10) * 2,
            font: { name: 'SimSun', eastAsia: 'SimSun' },
          }),
        ],
      });
    };

    const boldRun = (text: string, size = 10) => new TextRun({ text, bold: true, size: size * 2, font: { name: 'SimSun', eastAsia: 'SimSun' } });
    const run = (text: string, size = 10) => new TextRun({ text, size: size * 2, font: { name: 'SimSun', eastAsia: 'SimSun' } });
    const blankLine = () => new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [run('__________________________________', 11)],
    });

    const makeCell = (text: string, opts?: { bold?: boolean; width?: number; align?: 'center' | 'left'; bg?: string }) => new TableCell({
      children: [new Paragraph({
        alignment: opts?.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts?.bold, size: 20, font: { name: 'SimSun', eastAsia: 'SimSun' } })],
      })],
      width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      shading: opts?.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
    });

    const emptyCell = (opts?: { width?: number }) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })],
      width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    });

    const gridNumCell = (num: number) => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(num), size: 18, font: { name: 'SimSun', eastAsia: 'SimSun' } })],
      })],
      shading: { fill: 'F5F5F5', type: ShadingType.CLEAR },
      width: { size: 1000, type: WidthType.DXA },
    });

    const gridAnsCell = () => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: '', size: 20 })],
      })],
      width: { size: 1000, type: WidthType.DXA },
    });

    const children: (Paragraph | Table)[] = [];

    // === 密封线 (top) ===
    children.push(p('┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  密 封 线  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈', { size: 9, align: 'center', spacing: { after: 200 } }));

    // === Title Header ===
    children.push(p('数智化转型成熟度及数智化转型使能(DT+)人才培育体系', { size: 11, align: 'center', spacing: { after: 20 } }));
    children.push(p(`管理师（DTM）考试答题卡${paper.isOpenBook ? '（开卷）' : ''}`, { size: 14, bold: true, align: 'center', spacing: { after: 40 } }));
    children.push(p(`（编号：${paper.paperNumber || '—'}）`, { size: 9, align: 'center', spacing: { after: 200 } }));

    // === 判卷官须知 ===
    children.push(p('判卷官须知', { size: 9, bold: true, spacing: { before: 100, after: 40 } }));
    children.push(p('1. 答题卡统一密封不得拆开，统一红笔阅卷；', { size: 9 }));
    children.push(p('2. 主观题判分时，须划出得分点并标明相应得数；', { size: 9 }));
    children.push(p('3. 各题得分请统一填写在表1中，并签字确认；', { size: 9 }));
    children.push(p('4. 必要时，ITSS分会须组织专家对成绩进行复核。', { size: 9, spacing: { after: 160 } }));

    // === 表1: 成绩汇总表 ===
    children.push(p('《成绩表》        表1', { size: 10, bold: true, align: 'center', spacing: { after: 60 } }));

    const scoreHeaders = [
      '题型', '单选题', '判断题', '填空题', '简答题', '案例分析题', '总分'
    ];

    // 固定宽度分配（单位：dxa，约1/1440英寸）
    const scoreWidths = [1200, 1600, 1400, 1400, 1400, 1800, 1200];

    const scoreHeadCell = (text: string, i: number) => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 18, font: { name: 'SimSun', eastAsia: 'SimSun' } })],
      })],
      shading: { fill: 'F0F0F0', type: ShadingType.CLEAR },
      width: { size: scoreWidths[i], type: WidthType.DXA },
    });

    const scoreEmptyCell = (i: number) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })],
      width: { size: scoreWidths[i], type: WidthType.DXA },
    });

    const scoreHeaderRow = new TableRow({
      children: scoreHeaders.map((h, i) => scoreHeadCell(h, i)),
      tableHeader: true,
    });

    const scoreEmptyRow = new TableRow({
      children: scoreHeaders.map((_, i) => scoreEmptyCell(i)),
    });

    const signRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '阅卷人签字', bold: true, size: 18, font: { name: 'SimSun', eastAsia: 'SimSun' } })],
          })],
          width: { size: scoreWidths[0], type: WidthType.DXA },
        }),
        ...scoreHeaders.slice(1).map((_, i) => scoreEmptyCell(i + 1)),
      ],
    });

    children.push(new Table({
      rows: [scoreHeaderRow, scoreEmptyRow, scoreEmptyRow, signRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    children.push(p('', { spacing: { after: 120 } }));

    // === 考生信息 ===
    children.push(p('考生须知', { size: 9, bold: true, spacing: { before: 100, after: 40 } }));
    children.push(p('1. 请考生用正楷字填写姓名、身份证号和工作单位；', { size: 9 }));
    children.push(p('2. 请将答案填写在答题卡指定位置；', { size: 9 }));
    children.push(p('3. 不在指定位置或字迹不清楚的答案不计分。', { size: 9, spacing: { after: 120 } }));

    children.push(p('考生姓名：________________    身份证号：________________________', { size: 10, spacing: { after: 40 } }));
    children.push(p('工作单位：________________________________________________', { size: 10, spacing: { after: 200 } }));

    // === 密封线 ===
    children.push(p('┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  密 封 线  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈', { size: 9, align: 'center', spacing: { before: 200, after: 200 } }));

    // === 单选区 (表2) ===
    const singleChoice = groups['SINGLE_CHOICE'];
    const singleCount = singleChoice?.items?.length || 0;
    if (singleCount > 0) {
      children.push(p(`单选题（每题${singleChoice.scorePerQ}分，共${singleCount}题，共${singleChoice.totalScore}分）        表2`, { size: 10, bold: true, spacing: { after: 80 } }));

      // Create answer grid: 10 cols per row, with auto row count
      const gridNumRow = (start: number) => new TableRow({
        children: Array.from({ length: 10 }, (_, i) => gridNumCell(start + i)),
      });

      const gridAnswerRow = () => new TableRow({
        children: Array.from({ length: 10 }, () => gridAnsCell()),
      });

      const rows: TableRow[] = [];
      for (let r = 0; r * 10 < singleCount; r++) {
        const start = r * 10 + 1;
        rows.push(gridNumRow(start));
        rows.push(gridAnswerRow());
      }

      children.push(new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
      children.push(p('', { spacing: { after: 120 } }));
    }

    // === 判断题区 (表3) ===
    const tf = groups['TRUE_FALSE'];
    const tfCount = tf?.items?.length || 0;
    if (tfCount > 0) {
      children.push(p(`判断题（每题${tf.scorePerQ}分，共${tfCount}题，共${tf.totalScore}分  请填写"√"或"×"）        表3`, { size: 10, bold: true, spacing: { after: 40 } }));

      const tfCols = Math.min(5, tfCount);
      const tfRows = Math.ceil(tfCount / tfCols);
      const tfCellWidth = Math.floor(9000 / tfCols);

      const tfNumCell = (num: number) => new TableCell({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [new TextRun({ text: String(num), size: 18, font: { name: 'SimSun', eastAsia: 'SimSun' }, bold: true })],
        })],
        width: { size: tfCellWidth, type: WidthType.DXA },
      });
      const tfAnsCell = () => new TableCell({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: '', size: 20 })],
        })],
        width: { size: tfCellWidth, type: WidthType.DXA },
      });

      const tfRowsData: TableRow[] = [];
      for (let r = 0; r < tfRows; r++) {
        const start = r * tfCols + 1;
        const count = Math.min(tfCols, tfCount - start + 1);
        tfRowsData.push(new TableRow({
          children: Array.from({ length: count }, (_, i) => tfNumCell(start + i)),
        }));
        tfRowsData.push(new TableRow({
          children: Array.from({ length: count }, () => tfAnsCell()),
        }));
      }

      children.push(new Table({
        rows: tfRowsData,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
      children.push(p('', { spacing: { after: 120 } }));
    }

    // === 填空题区 (表4) ===
    const fill = groups['FILL_BLANK'];
    const fillCount = fill?.items?.length || 0;
    let blankTotal = 0;
    if (fillCount > 0) {
      // Count total blanks
      for (const item of fill.items) {
        const blanks = item.question?.blanks || [];
        blankTotal += blanks.length || 1;
      }
      children.push(p(`填空题（每空${fill.scorePerQ}分，共${blankTotal}空，共${fill.totalScore}分）        表4`, { size: 10, bold: true, spacing: { after: 40 } }));

      for (let i = 1; i <= blankTotal; i++) {
        children.push(p(`${i}. ____________________________________________`, { size: 10, spacing: { before: 12, after: 12 } }));
      }
      children.push(p('', { spacing: { after: 120 } }));
    }

    // === 密封线 ===
    children.push(p('┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  密 封 线  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈', { size: 9, align: 'center', spacing: { before: 200, after: 200 } }));

    // === 简答题区 ===
    const shortAnswer = groups['SHORT_ANSWER'];
    const saCount = shortAnswer?.items?.length || 0;
    if (saCount > 0) {
      children.push(p(`简答题（每题${shortAnswer.scorePerQ}分，共${saCount}题，共${shortAnswer.totalScore}分）`, { size: 10, bold: true, spacing: { after: 40 } }));

      for (let i = 1; i <= saCount; i++) {
        children.push(p(`简答题${i}：`, { size: 10, bold: true, spacing: { before: 60, after: 20 } }));
        // 5 points → ~6 lines of space
        const lines = Math.max(4, shortAnswer.scorePerQ);
        for (let l = 0; l < lines; l++) {
          children.push(new Paragraph({
            spacing: { before: 20, after: 20 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA', space: 2 } },
            children: [new TextRun({ text: '', size: 20 })],
          }));
        }
        children.push(p('', { spacing: { after: 80 } }));
      }
    }

    // === 案例题区 ===
    const caseStudy = groups['CASE_STUDY'];
    const csCount = caseStudy?.items?.length || 0;
    if (csCount > 0) {
      children.push(p(`案例分析（每题${caseStudy.scorePerQ}分，共${csCount}题，共${caseStudy.totalScore}分）`, { size: 10, bold: true, spacing: { after: 40 } }));

      for (let i = 1; i <= csCount; i++) {
        children.push(p(`案例分析${i}：`, { size: 10, bold: true, spacing: { before: 60, after: 20 } }));
        // 15 points → more lines
        const lines = Math.max(8, Math.round(caseStudy.scorePerQ * 0.6));
        for (let l = 0; l < lines; l++) {
          children.push(new Paragraph({
            spacing: { before: 20, after: 20 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA', space: 2 } },
            children: [new TextRun({ text: '', size: 20 })],
          }));
        }
        children.push(p('', { spacing: { after: 80 } }));
      }
    }

    // === Footer ===
    children.push(p('', { spacing: { before: 200 } }));
    children.push(p('内部资料 严禁拍照 严禁带走 违者必究', { size: 9, bold: true, align: 'center', spacing: { before: 100 } }));

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'SimSun', size: 20 },
            paragraph: { spacing: { line: 320 } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
            },
          },
        },
        children,
      }],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }
}

