import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { LearningHoursService } from './learning-hours.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/learning-hours')
export class LearningHoursController {
  constructor(private service: LearningHoursService) {}

  @Get()
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async findAll(
    @Req() req: any,
    @Query('programId') programId?: string,
    @Query('source') source?: string,
  ) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.findAll(studentId, {
      programId: programId ? parseInt(programId) : undefined,
      source,
    });
  }

  @Get('stats')
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async stats(@Req() req: any) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.stats(studentId);
  }

  @Get('program/:programId')
  @RequirePermission(P.PROGRAM_VIEW)
  programStats(@Param('programId', ParseIntPipe) programId: number) {
    return this.service.programStats(programId);
  }
}
