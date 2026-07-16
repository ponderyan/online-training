import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuditLogsService } from './audit-logs.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/audit-logs')
export class AuditLogsController {
  constructor(private service: AuditLogsService) {}

  /** 导出审计日志为 CSV（UTF-8 BOM 兼容 Excel 中文），复用筛选逻辑不分页 */
  @Get('export')
  @RequirePermission(Permissions.AUDIT_LOG_VIEW)
  async export(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('operatorId') operatorId?: string,
    @Query('operatorName') operatorName?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('changeReason') changeReason?: string,
    @Res() res?: Response,
  ) {
    const logs = await this.service.findAllForExport({
      entityType, action,
      operatorId: operatorId ? parseInt(operatorId) : undefined,
      operatorName,
      entityId: entityId ? parseInt(entityId) : undefined,
      startDate, endDate,
      includeArchived: includeArchived === 'true',
      changeReason,
    });

    const headers = ['时间', '操作人', '实体类型', '实体ID', '操作', '变更原因', '来源', 'IP', '修改前摘要', '修改后摘要'];
    const rows = logs.map((log: any) => [
      log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '',
      log.operatorName || `用户#${log.operatorId || '?'}`,
      log.entityType || '',
      String(log.entityId ?? ''),
      log.action || '',
      log.changeReason || '',
      log.eventSource || '',
      log.ip || '',
      log.before ? JSON.stringify(log.before) : '',
      log.after ? JSON.stringify(log.after) : '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const dateStr = new Date().toISOString().split('T')[0];
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="audit_logs_${dateStr}.csv"`);
    // UTF-8 BOM 头，兼容 Excel 中文
    res!.send('\ufeff' + csv);
  }

  @Get()
  @RequirePermission(Permissions.AUDIT_LOG_VIEW)
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('operatorId') operatorId?: string,
    @Query('operatorName') operatorName?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sort') sort?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('changeReason') changeReason?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      entityType, action,
      operatorId: operatorId ? parseInt(operatorId) : undefined,
      operatorName,
      entityId: entityId ? parseInt(entityId) : undefined,
      startDate, endDate, sort,
      includeArchived: includeArchived === 'true',
      changeReason,
    });
  }
}
