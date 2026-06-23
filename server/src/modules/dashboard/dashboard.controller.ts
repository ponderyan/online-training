import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('stats')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getStats() {
    return this.service.getStats();
  }
}
