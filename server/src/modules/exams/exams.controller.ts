import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { ExamAccessService } from '../../common/services/exam-access.service.js';

@Controller('api/exams')
export class ExamsController {
  constructor(private service: ExamsService, private systemConfig: SystemConfigService, private examAccess: ExamAccessService) {}

  @Get()
  @RequirePermission(Permissions.EXAM_RESULT_VIEW)
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('paperId') paperId?: string,
    @Query('programId') programId?: string,
    @Query('examMode') examMode?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      keyword, status, examMode,
      paperId: paperId ? parseInt(paperId) : undefined,
      programId: programId ? parseInt(programId) : undefined,
      userOrgId: req.user?.orgId ?? null,
      userRoles: req.user?.roles,
    });
  }

  @Get(':id')
  @RequirePermission(Permissions.EXAM_RESULT_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Post()
  @RequirePermission(Permissions.EXAM_CREATE)
  create(@Body() data: {
    title: string; paperId: number; createdBy: number;
    startTime: string; endTime: string; durationMinutes: number;
    accessType?: string; shuffleQuestions?: boolean; shuffleOptions?: boolean;
    password?: string;
    programId?: number; passingScore?: number;
    timeMode?: string; paperMode?: string;
    tabSwitchLimit?: number; copyProtection?: boolean; autoSaveInterval?: number;
    scorePublishMode?: string;
    publishAt?: string;
    examMode?: string;
    locations?: any;
  }, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const userOrgId = req.user?.orgId ?? null;
    const userRoles: string[] = req.user?.roles || [];
    // 机构角色创建考试 → 检查 allow_org_own_bank 开关
    if (userOrgId && !userRoles.includes('SUPER_ADMIN')) {
      return this.systemConfig.getBoolean('allow_org_own_bank').then(allow => {
        if (!allow) throw new ForbiddenException('当前系统不允许机构自建题库，无法创建考试');
        return this.service.create({ ...data, createdBy: userId, orgId: userOrgId });
      });
    }
    return this.service.create({ ...data, createdBy: userId, orgId: userOrgId });
  }

  @Put(':id')
  @RequirePermission(Permissions.EXAM_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    return this.service.update(id, data, req.user?.orgId ?? null, req.user?.roles);
  }

  @Delete(':id')
  @RequirePermission(Permissions.EXAM_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Put(':id/publish')
  @RequirePermission(Permissions.EXAM_CREATE)
  publish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.publish(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Put(':id/finish')
  @RequirePermission(Permissions.EXAM_EDIT)
  finish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.finish(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Get(':id/students')
  @RequirePermission(Permissions.EXAM_RESULT_VIEW)
  async getStudents(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.examAccess.assertAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.getStudents(id);
  }

  @Post(':id/add-students')
  @RequirePermission(Permissions.EXAM_ASSIGN)
  async addStudents(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { studentIds: number[] },
    @Req() req: any,
  ) {
    await this.examAccess.assertAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.addStudents(id, data.studentIds, req.user?.orgId ?? null, req.user?.roles);
  }

  @Get(':id/grading-progress')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getGradingProgress(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.examAccess.assertAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.getGradingProgress(id);
  }

  @Get(':id/sessions/status-summary')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getSessionStatusSummary(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.examAccess.assertAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.getSessionStatusSummary(id);
  }
}
