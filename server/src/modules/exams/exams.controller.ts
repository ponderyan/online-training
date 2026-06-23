import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class ExamsController {
  constructor(private service: ExamsService) {}

  @Get()
  @RequirePermission(Permissions.EXAM_CREATE)
  findAll(
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
    });
  }

  @Get(':id')
  @RequirePermission(Permissions.EXAM_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.EXAM_CREATE)
  create(@Body() data: {
    title: string; paperId: number; createdBy: number;
    startTime: string; endTime: string; durationMinutes: number;
    accessType?: string; shuffleQuestions?: boolean; shuffleOptions?: boolean;
    password?: string;
    programId?: number; passingScore?: number;
  }) { return this.service.create(data); }

  @Put(':id')
  @RequirePermission(Permissions.EXAM_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  @RequirePermission(Permissions.EXAM_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Put(':id/publish')
  @RequirePermission(Permissions.EXAM_CREATE)
  publish(@Param('id', ParseIntPipe) id: number) { return this.service.publish(id); }

  @Put(':id/finish')
  @RequirePermission(Permissions.EXAM_EDIT)
  finish(@Param('id', ParseIntPipe) id: number) { return this.service.finish(id); }

  @Get(':id/students')
  @RequirePermission(Permissions.EXAM_CREATE)
  getStudents(@Param('id', ParseIntPipe) id: number) { return this.service.getStudents(id); }

  @Post(':id/add-students')
  @RequirePermission(Permissions.EXAM_ASSIGN)
  addStudents(@Param('id', ParseIntPipe) id: number, @Body() data: { studentIds: number[] }) {
    return this.service.addStudents(id, data.studentIds);
  }

  /** Part 1: 阅卷进度统计 */
  @Get(':id/grading-progress')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getGradingProgress(@Param('id', ParseIntPipe) id: number) {
    return this.service.getGradingProgress(id);
  }

  @Get(':id/sessions/status-summary')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getSessionStatusSummary(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSessionStatusSummary(id);
  }

  @Get(':id/transcript')
  @RequirePermission(Permissions.TRANSCRIPT_VIEW)
  async getTranscript(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTranscript(id);
  }
}
