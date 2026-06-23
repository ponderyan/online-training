import { Controller, Get, Post, Param, Query, UploadedFile, UseInterceptors, Req, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DataImportExportService } from './data-import-export.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/data')
export class DataImportExportController {
  constructor(private service: DataImportExportService) {}

  @Post('import/:module')
  @RequirePermission(Permissions.STUDENT_IMPORT)
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@Param('module') module: string, @UploadedFile() file: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.import(module, file, userId);
  }

  @Get('import/logs')
  @RequirePermission(Permissions.STUDENT_IMPORT)
  async getImportLogs(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.getImportLogs(page ? parseInt(page) : 1, pageSize ? parseInt(pageSize) : 20);
  }

  @Get('export/logs')
  @RequirePermission(Permissions.REPORT_EXPORT)
  async getExportLogs(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('module') module?: string) {
    return this.service.getExportLogs({ page: page ? parseInt(page) : 1, pageSize: pageSize ? parseInt(pageSize) : 20, module });
  }

  @Get('export/:module')
  @RequirePermission(Permissions.REPORT_EXPORT)
  async exportData(@Param('module') module: string, @Query() query: any, @Req() req: any, @Res() res: Response) {
    const userId = req.user?.sub || req.user?.id || 1;
    const { buffer, fileName } = await this.service.export(module, query, userId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
