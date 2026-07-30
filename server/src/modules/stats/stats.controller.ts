import { Controller, Get, Req } from '@nestjs/common';
import { StatsService } from './stats.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/stats')
export class StatsController {
  constructor(private service: StatsService) {}

  @Get('exam-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getExamOverview(@Req() req: any) {
    return this.service.getExamOverview(req.user?.orgId ?? null, req.user?.roles);
  }

  @Get('hours-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getHoursOverview(@Req() req: any) {
    return this.service.getHoursOverview(req.user?.orgId ?? null, req.user?.roles);
  }

  @Get('cert-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getCertOverview(@Req() req: any) {
    return this.service.getCertOverview(req.user?.orgId ?? null, req.user?.roles);
  }

  @Get('student-activity')
  @RequirePermission(Permissions.STATS_VIEW)
  async getStudentActivity(@Req() req: any) {
    return this.service.getStudentActivity(req.user?.orgId ?? null, req.user?.roles);
  }
}
