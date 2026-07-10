import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { QuestionType } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/questions')
export class QuestionsController {
  constructor(
    private service: QuestionsService,
    private systemConfig: SystemConfigService,
  ) {}

  @Get()
  @RequirePermission(Permissions.QUESTION_CREATE)
  findAll(
    @Req() req: any,
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('materialId') materialId?: string,
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
      materialId: materialId ? parseInt(materialId) : undefined,
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

    // ★ orgId 隔离：传递用户上下文
    params.userOrgId = req.user?.orgId ?? null;
    params.userRoles = userRoles;

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

  @Get('practice/trend')
  @UseGuards(JwtAuthGuard)
  getPracticeTrend(@Req() req: any, @Query('days') days?: string) {
    return this.service.getPracticeTrend(req.user.id, days ? parseInt(days) : 30);
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
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Get(':id/referenced-papers')
  @RequirePermission(Permissions.QUESTION_CREATE)
  getReferencedPapers(@Param('id', ParseIntPipe) id: number) {
    return this.service.getReferencedPapers(id);
  }

  @Post()
  @RequirePermission(Permissions.QUESTION_CREATE)
  async create(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const userOrgId = req.user?.orgId ?? null;
    const userRoles: string[] = req.user?.roles || [];

    // 机构角色创建题目 → 检查 allow_org_own_bank 开关
    if (userOrgId && !userRoles.includes('SUPER_ADMIN')) {
      const allow = await this.systemConfig.getBoolean('allow_org_own_bank');
      if (!allow) {
        throw new ForbiddenException('当前系统不允许机构自建题库');
      }
    }

    return this.service.create({ ...data, createdBy: userId, orgId: userOrgId });
  }

  @Post('batch')
  @RequirePermission(Permissions.QUESTION_CREATE)
  async batchCreate(@Body() data: { questions: any[] }, @Req() req: any) {
    const userOrgId = req.user?.orgId ?? null;
    const userRoles: string[] = req.user?.roles || [];

    // 机构角色批量创建 → 检查开关
    if (userOrgId && !userRoles.includes('SUPER_ADMIN')) {
      const allow = await this.systemConfig.getBoolean('allow_org_own_bank');
      if (!allow) {
        throw new ForbiddenException('当前系统不允许机构自建题库');
      }
    }

    return this.service.batchCreate(data.questions, userOrgId);
  }

  @Post('ai-generate')
  async aiGeneratePlaceholder() {
    return { success: true, message: 'AI 智能出题功能开发中，敬请期待' };
  }

  @Put(':id')
  @RequirePermission(Permissions.QUESTION_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    return this.service.update(id, data, req.user?.orgId ?? null, req.user?.roles);
  }

  @Delete(':id')
  @RequirePermission(Permissions.QUESTION_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user?.orgId ?? null, req.user?.roles);
  }
}
