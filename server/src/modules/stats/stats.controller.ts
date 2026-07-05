import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/stats')
export class StatsController {
  constructor(private service: StatsService) {}

  @Get('exam-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getExamOverview() {
    return this.service.getExamOverview();
  }

  @Get('hours-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getHoursOverview() {
    return this.service.getHoursOverview();
  }

  @Get('cert-overview')
  @RequirePermission(Permissions.STATS_VIEW)
  async getCertOverview() {
    return this.service.getCertOverview();
  }

  @Get('student-activity')
  @RequirePermission(Permissions.STATS_VIEW)
  async getStudentActivity() {
    return this.service.getStudentActivity();
  }
}
