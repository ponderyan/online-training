import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/audit-trail')
export class AuditTrailController {
  constructor(private service: AuditTrailService) {}

  /** 搜索业务实体（考试/培训班），供前端选择器使用 */
  @Get('search')
  @RequirePermission(Permissions.AUDIT_LOG_VIEW)
  async search(@Query('entityType') entityType?: string, @Query('keyword') keyword?: string) {
    return this.service.searchEntities(entityType || 'EXAM', keyword || '');
  }

  /** 全链审计：获取业务实体的完整生命周期事件时间线 */
  @Get(':entityType/:entityId')
  @RequirePermission(Permissions.AUDIT_LOG_VIEW)
  async getTrail(@Param('entityType') entityType: string, @Param('entityId', ParseIntPipe) entityId: number) {
    return this.service.getTrail(entityType, entityId);
  }
}
