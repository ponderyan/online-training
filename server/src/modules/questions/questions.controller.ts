import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
import { QuestionType } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/questions')
export class QuestionsController {
  constructor(private service: QuestionsService) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findAll(
    @Req() req: any,
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
    const params: any = {
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      chapterId: chapterId ? parseInt(chapterId) : undefined,
      type, difficulty, status, keyword,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    };

    const userRoles: string[] = req.user?.roles || [];
    if (userRoles.includes('LECTURER') && !userRoles.some(r =>
      ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER'].includes(r)
    )) {
      params.createdBy = req.user.sub || req.user.id;
    }

    return this.service.findAll(params);
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

  @Post('practice/submit')
  @UseGuards(JwtAuthGuard)
  submitPractice(
    @Body() data: { questionId: number; answer: any },
    @Req() req: any,
  ) {
    return this.service.submitPractice({
      studentId: req.user.id,
      questionId: data.questionId,
      answer: data.answer,
    });
  }

  @Get('practice/records')
  @UseGuards(JwtAuthGuard)
  getPracticeRecords(
    @Req() req: any,
    @Query('onlyWrong') onlyWrong?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.getPracticeRecords({
      studentId: req.user.id,
      onlyWrong: onlyWrong === 'true',
      subjectId: subjectId ? parseInt(subjectId) : undefined,
    });
  }

  @Get('practice/stats')
  @UseGuards(JwtAuthGuard)
  getPracticeStats(@Req() req: any) {
    return this.service.getPracticeStats(req.user.id);
  }

  @Post('practice/favorite/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(
    @Body() data: { questionId: number },
    @Req() req: any,
  ) {
    return this.service.toggleFavorite(req.user.id, data.questionId);
  }

  @Get('practice/favorites')
  @UseGuards(JwtAuthGuard)
  getFavoriteQuestions(
    @Req() req: any,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.getFavoriteQuestions({
      studentId: req.user.id,
      subjectId: subjectId ? parseInt(subjectId) : undefined,
    });
  }

  @Get('practice/favorite/ids')
  @UseGuards(JwtAuthGuard)
  getFavoriteIds(@Req() req: any) {
    return this.service.getFavoriteIds(req.user.id);
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
  create(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.create({ ...data, createdBy: userId });
  }

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
