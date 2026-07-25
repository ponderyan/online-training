import { Controller, Get, Req, ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR', 'AGENCY_ADMIN'];

@Controller('api/dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    const user = req.user;
    const roles: string[] = user?.roles || [];
    // 纯学员无需调用管理端统计接口
    const hasAdminRole = roles.some(r => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) {
      throw new ForbiddenException('该接口仅供管理角色使用');
    }
    return this.service.getStats(user);
  }
}
