import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Difficulty, QuestionType, PaperStatus } from '@prisma/client';
import { join } from 'path';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { execSync } from 'child_process';

@Injectable()
export class PapersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.paper.findMany({
        skip, take: pageSize, orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { name: true, code: true } },
          creator: { select: { displayName: true } },
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.paper.count(),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number) {
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
    return paper;
  }

  async generate(data: {
    name: string; subjectId: number; createdBy: number;
    totalScore: number; durationMinutes?: number; isOpenBook?: boolean;
    typeConfigs: { questionType: QuestionType; count: number; scorePerQuestion: number }[];
    difficultyDistribution: Record<string, number>;
    chapterStrategy?: string; sourceMix?: number;
    excludeQuestionIds?: number[];
  }) {
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
    let subtotalCheck = 0;

    for (const tc of data.typeConfigs) {
      subtotalCheck += tc.count * tc.scorePerQuestion;
      const difficultyMap = data.difficultyDistribution;
      let countPerDifficulty: Record<string, number>;
      if (tc.count === 0) continue;

      if (Object.keys(difficultyMap).length > 0) {
        const totalWeight = Object.values(difficultyMap).reduce((a, b) => a + b, 0);
        countPerDifficulty = {};
        let allocated = 0;
        for (const [diff, weight] of Object.entries(difficultyMap)) {
          const c = Math.round((weight / totalWeight) * tc.count);
          countPerDifficulty[diff] = c;
          allocated += c;
        }
        const diffs = Object.keys(difficultyMap);
        for (let i = 0; allocated < tc.count && i < diffs.length; i++) {
          countPerDifficulty[diffs[i]]++;
          allocated++;
        }
      } else {
        countPerDifficulty = { EASY: tc.count };
      }

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
          ...(data.excludeQuestionIds?.length
            ? { id: { notIn: data.excludeQuestionIds } }
            : {}),
        };

        const available = await this.prisma.question.findMany({
          where,
          select: { id: true },
          take: count * 3,
        });

        const shuffled = available.sort(() => Math.random() - 0.5).slice(0, count);
        for (const q of shuffled) {
          selectedQuestions.push({
            questionId: q.id,
            score: tc.scorePerQuestion,
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

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.paper.delete({ where: { id } });
  }

  async generateExportHtml(id: number): Promise<string> {
    const paper = await this.findOne(id);
    const typeNames: Record<string, string> = {
      SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
      FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
    };

    let qHtml = '';
    for (const pq of paper.questions) {
      const q = pq.question;
      const optionsHtml = q.options?.length
        ? '<div class="options">' + q.options.map((o: any) =>
            `<div class="option"><span class="label">${o.label}.</span> ${o.content}</div>`
          ).join('') + '</div>'
        : '';
      const blanksHtml = q.blanks?.length
        ? '<div class="blanks">' + q.blanks.map((b: any) =>
            `<div class="blank">填空 ${b.blankIndex + 1}: __________</div>`
          ).join('') + '</div>'
        : '';
      const subHtml = q.subQuestions?.length
        ? '<div class="sub-questions">' + q.subQuestions.map((sq: any, si: number) =>
            `<div class="sub-q">(${si + 1}) ${sq.content}</div>`
          ).join('') + '</div>'
        : '';

      qHtml += `<div class="question">
        <div class="q-header">
          <span class="q-num">${pq.sortOrder + 1}.</span>
          <span class="q-type">[${typeNames[q.type] || q.type}]</span>
          <span class="q-content">${q.content}</span>
          <span class="q-score">（${pq.score} 分）</span>
        </div>
        ${optionsHtml}
        ${blanksHtml}
        ${subHtml}
      </div>`;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${paper.name}</title>
<style>
  @page { margin: 2.5cm 2cm; }
  body { font-family: 'SimSun', '宋体', serif; font-size: 12pt; line-height: 1.8; color: #1a1712; max-width: 210mm; margin: 0 auto; padding: 20px; }
  .paper-title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 5px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
  .info-table td { border: 1px solid #333; padding: 6px 10px; }
  .info-table td:first-child { width: 120px; background: #f5f5f5; font-weight: bold; text-align: center; }
  .section-title { font-size: 13pt; font-weight: bold; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #333; }
  .question { margin-bottom: 16px; }
  .q-header { margin-bottom: 4px; }
  .q-num { font-weight: bold; }
  .q-type { color: #c9a03a; font-size: 9pt; margin: 0 4px; }
  .q-score { color: #8b8174; font-size: 9pt; }
  .options { padding-left: 24px; }
  .option { margin: 2px 0; }
  .label { font-weight: bold; }
  .blanks { padding-left: 24px; color: #00897b; }
  .sub-questions { padding-left: 24px; }
  .sub-q { margin: 4px 0; }
  .footer { text-align: center; font-size: 9pt; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
  <div class="paper-title">${paper.name}</div>

  <table class="info-table">
    <tr><td>考试科目</td><td>${paper.subject?.name || '—'}</td><td>试卷满分</td><td>${paper.totalScore} 分</td></tr>
    <tr><td>考试时间</td><td>${paper.durationMinutes || '—'} 分钟</td><td>考试形式</td><td>${paper.isOpenBook ? '开卷' : '闭卷'}</td></tr>
  </table>

  <div id="questions">${qHtml}</div>

  <div class="footer">${paper.paperNumber || ''} · 共 ${paper.questions.length} 题 · 总分 ${paper.totalScore} 分</div>
</body>
</html>`;
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
    const html = await this.generateExportHtml(id);
    const tmpDir = join('/tmp', 'paper-docx-' + id + '-' + Date.now());
    await mkdir(tmpDir, { recursive: true });
    const htmlPath = join(tmpDir, 'paper.html');
    const docxPath = join(tmpDir, 'paper.docx');
    await writeFile(htmlPath, html, 'utf-8');
    try {
      execSync('soffice --headless --convert-to "docx:MS Word 2007 XML" --outdir ' + tmpDir + ' ' + htmlPath, { timeout: 30000 });
      return await readFile(docxPath);
    } finally {
      execSync('rm -rf ' + tmpDir, { timeout: 5000 });
    }
  }
}

