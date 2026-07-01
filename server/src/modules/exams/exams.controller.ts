import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, ParseIntPipe } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class ExamsController {
  constructor(private service: ExamsService) {}

  @Get()
  @RequirePermission(Permissions.EXAM_CREATE)
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('paperId') paperId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      keyword, status,
      paperId: paperId ? parseInt(paperId) : undefined,
      programId: programId ? parseInt(programId) : undefined,
      userOrgId: req.user?.orgId ?? null,
      userRoles: req.user?.roles,
    });
  }

  @Get(':id')
  @RequirePermission(Permissions.EXAM_CREATE)
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
  }, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.create({ ...data, createdBy: userId, orgId: req.user?.orgId ?? null });
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
  @RequirePermission(Permissions.EXAM_CREATE)
  getStudents(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStudents(id);
  }

  @Post(':id/add-students')
  @RequirePermission(Permissions.EXAM_ASSIGN)
  addStudents(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { studentIds: number[] },
  ) {
    return this.service.addStudents(id, data.studentIds);
  }
}
