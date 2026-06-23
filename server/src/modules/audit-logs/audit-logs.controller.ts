import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/audit-logs')
export class AuditLogsController {
  constructor(private service: AuditLogsService) {}

  @Get()
  @RequirePermission(Permissions.SYSTEM_LOGS)
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('operatorId') operatorId?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sort') sort?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      entityType, action,
      operatorId: operatorId ? parseInt(operatorId) : undefined,
      entityId: entityId ? parseInt(entityId) : undefined,
      startDate, endDate, sort,
    });
  }
}
