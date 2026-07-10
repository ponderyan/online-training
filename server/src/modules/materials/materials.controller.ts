import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { MaterialsService } from './materials.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/materials')
export class MaterialsController {
  constructor(private service: MaterialsService) {}

  @Get()
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      status,
    });
  }

  @Get('list-for-filter')
  @RequirePermission(Permissions.QUESTION_CREATE)
  listForFilter() {
    return this.service.listForFilter();
  }

  @Get(':id')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/stats')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStats(id);
  }

  @Post()
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  async create(@Body() data: {
    name: string;
    subjectId: number;
    createdBy?: number;
    batchNote?: string;
    content?: string;
  }, @Req() req: any) {
    return this.service.create({ ...data, createdBy: req.user.id });
  }

  @Post('upload')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (ext !== '.pdf' && ext !== '.pptx' && ext !== '.docx') {
        cb(new BadRequestException('仅支持 PDF / PPTX / DOCX 格式'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { subjectId: string; name?: string; batchNote?: string; createdBy: string },
  ) {
    return this.service.upload(file, body);
  }

  @Put('questions/:id/review')
  @RequirePermission(Permissions.MATERIAL_REVIEW)
  reviewQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      reviewStatus: 'APPROVED' | 'REJECTED' | 'EDITED';
      reviewNote?: string;
      content?: string;
      options?: any;
      blanks?: any;
      answer?: string;
      explanation?: string;
      difficulty?: string;
      suggestedGroup?: string;
    },
  ) {
    return this.service.reviewQuestion(id, data);
  }

  @Post(':id/batch-review')
  @RequirePermission(Permissions.MATERIAL_REVIEW)
  batchReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: 'approve' | 'reject'; questionIds?: number[] },
  ) {
    return this.service.batchReview(id, data);
  }

  @Post(':id/generate')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  generateQuestions(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateQuestions(id);
  }

  // ── 章节编辑 API ──

  @Put(':id/chapters/:chapterId')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  updateChapter(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Body() data: { title: string },
  ) {
    return this.service.updateChapter(id, chapterId, data);
  }

  @Post(':id/chapters/merge')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  mergeChapters(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { chapterIds: number[] },
  ) {
    return this.service.mergeChapters(id, data);
  }

  @Post(':id/chapters/split')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  splitChapter(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { chapterId: number; splitPosition: number },
  ) {
    return this.service.splitChapter(id, data);
  }

  @Delete(':id/chapters/:chapterId')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  deleteChapter(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
  ) {
    return this.service.deleteChapter(id, chapterId);
  }

  @Post(':id/confirm-structure')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  confirmStructure(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmStructure(id);
  }

  @Get(':id/chapters/:chapterId/content')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  getChapterContent(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
  ) {
    return this.service.getChapterContent(id, chapterId);
  }

  // ── 出题计划 API ──

  @Get(':id/question-plans')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  getQuestionPlans(@Param('id', ParseIntPipe) id: number) {
    return this.service.getQuestionPlans(id);
  }

  @Post(':id/question-plans')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  createQuestionPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; configs: { chapterId: number; type: string; count: number; difficultyEasy?: number; difficultyMedium?: number; difficultyHard?: number; focusKeywords?: string }[] },
  ) {
    return this.service.createQuestionPlan(id, data);
  }

  @Post(':id/execute-plan/:planId')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  executeQuestionPlan(
    @Param('id', ParseIntPipe) id: number,
    @Param('planId', ParseIntPipe) planId: number,
  ) {
    return this.service.executeQuestionPlan(id, planId);
  }

  @Get(':id/plan-progress/:planId')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  getPlanProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('planId', ParseIntPipe) planId: number,
  ) {
    return this.service.getPlanProgress(id, planId);
  }

  @Post(':id/generate-from-batchNote')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  generateFromBatchNote(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateFromBatchNote(id);
  }

  @Delete(':id')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
