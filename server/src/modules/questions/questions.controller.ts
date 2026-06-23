import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
import { QuestionType } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/questions')
export class QuestionsController {
  constructor(private service: QuestionsService) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findAll(
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      chapterId: chapterId ? parseInt(chapterId) : undefined,
      type, difficulty, status, keyword,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('practice')
  getPracticeQuestions(
    @Query('count') count?: string,
    @Query('subjectId') subjectId?: string,
    @Query('types') types?: string,
    @Query('chapterId') chapterId?: string,
  ) {
    return this.service.getPracticeQuestions(
      count ? parseInt(count) : 10,
      subjectId ? parseInt(subjectId) : undefined,
      types ? types.split(',') : undefined,
      chapterId ? parseInt(chapterId) : undefined,
    );
  }

  @Get('practice/answer')
  getPracticeAnswer(@Query('questionId') questionId?: string) {
    return this.service.getPracticeAnswer(questionId ? parseInt(questionId) : undefined);
  }

  @Get(':id')
  @RequirePermission(Permissions.QUESTION_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Get(':id/referenced-papers')
  @RequirePermission(Permissions.QUESTION_CREATE)
  getReferencedPapers(@Param('id', ParseIntPipe) id: number) {
    return this.service.getReferencedPapers(id);
  }

  @Post()
  @RequirePermission(Permissions.QUESTION_CREATE)
  create(@Body() data: any) { return this.service.create(data); }

  @Post('batch')
  @RequirePermission(Permissions.QUESTION_CREATE)
  batchCreate(@Body() data: { questions: any[] }) {
    return this.service.batchCreate(data.questions);
  }

  @Post('ai-generate')
  async aiGeneratePlaceholder() {
    return { success: true, message: 'AI 智能出题功能开发中，敬请期待' };
  }

  @Put(':id')
  @RequirePermission(Permissions.QUESTION_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  @RequirePermission(Permissions.QUESTION_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
