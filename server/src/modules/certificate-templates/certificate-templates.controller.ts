import { Controller, Post, Body, Res, Get, Query, Param, Put, Delete, Req, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { CertificateTemplatesService } from './certificate-templates.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import type { CanvasDef, TemplateData, RenderMode } from './renderer/canvas-types.js';

@Controller('api/certificate-templates')
export class CertificateTemplatesController {
  constructor(private service: CertificateTemplatesService) {}

  // ═══════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════

  @Get()
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  findAll(@Req() req: any, @Query('type') type?: string, @Query('isActive') isActive?: string, @Query('search') search?: string, @Query('sortBy') sortBy?: string) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.findAll(orgId, isSuperAdmin, {
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      sortBy,
    });
  }

  /**
   * 下载 Excel 导入模板（含变量列头）。
   */
  @Get('batch-template')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async downloadBatchTemplate(@Res() res: Response) {
    const XLSX = await import('xlsx');
    const headers = ['studentName', 'courseName', 'certificateNo', 'issueDate', 'orgName', 'idCard', 'idCardMasked', 'totalHours', 'startDate', 'endDate'];
    const labels = ['姓名', '课程名', '证书编号', '发证日期', '机构名', '身份证(完整)', '身份证(脱敏)', '总学时', '开始日期', '结束日期'];
    const ws = XLSX.utils.aoa_to_sheet([labels, headers, ['张三', '人工智能应用', 'CERT-2026-001', '2026-07-30', '示例机构', '110101199001011234', '110***1234', '48', '2026-01-01', '2026-06-30']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '证书数据');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="certificate_batch_template.xlsx"',
      'Content-Length': buf.length,
    });
    res.end(buf);
  }

  @Get(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  findById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.findById(id, orgId, isSuperAdmin);
  }

  @Post()
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async create(@Body() body: { name: string; description?: string; type?: string; canvasJson: any; orgId?: number; isDefault?: boolean }, @Req() req: any) {
    const userId = req.user?.id || 1;
    const orgId = req.user?.orgId || null;
    const result = await this.service.create(body, userId, orgId);
    this.service.regenerateThumbnail(result.id).catch(() => {});
    return result;
  }

  @Put(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const userId = req.user?.id || 1;
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    const result = await this.service.update(id, body, userId, orgId, isSuperAdmin);
    if (body.canvasJson) this.service.regenerateThumbnail(id).catch(() => {});
    return result;
  }

  @Delete(':id')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.remove(id, orgId, isSuperAdmin);
  }

  /** 硬删除（★ 2026-08-15：仅已停用 + 未被引用的模板；废弃原因经 changeReason 写审计日志） */
  @Post(':id/permanent')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async permanentDelete(@Param('id', ParseIntPipe) id: number, @Body() data: { reason: string }, @Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    // 操作人：displayName 为空时回退 username（admin 等账号可能无 displayName）
    const operator = { id: req.user?.id, name: req.user?.displayName || req.user?.username };
    return this.service.hardRemove(id, orgId, isSuperAdmin, operator, data?.reason);
  }

  @Post(':id/duplicate')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  duplicate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || 1;
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.duplicate(id, userId, orgId, isSuperAdmin);
  }

  @Post(':id/set-default')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  setDefault(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.setDefault(id, orgId, isSuperAdmin);
  }

  @Post(':id/clear-default')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  clearDefault(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const orgId = req.user?.orgId || null;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') || false;
    return this.service.clearDefault(id, orgId, isSuperAdmin);
  }

  @Post(':id/regenerate-thumbnail')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async regenerateThumbnail(@Param('id', ParseIntPipe) id: number) {
    await this.service.regenerateThumbnail(id);
    return { success: true };
  }

  // ═══════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════

  @Post('render-html')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  renderHtml(@Body() body: { canvas: CanvasDef; data?: TemplateData; mode?: RenderMode }) {
    return { html: this.service.renderHtml(body.canvas, body.data || {}, body.mode) };
  }

  @Post('render-pdf')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async renderPdf(
    @Body() body: { canvas: CanvasDef; data?: TemplateData; filename?: string; mode?: RenderMode; dpi?: number },
    @Res() res: Response,
  ) {
    const pdf = await this.service.renderPdf(body.canvas, body.data || {}, { mode: body.mode, dpi: body.dpi });
    const filename = body.filename || 'certificate-template.pdf';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Post('render-thumbnail')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async renderThumbnail(
    @Body() body: { canvas: CanvasDef; data?: TemplateData },
    @Res() res: Response,
  ) {
    const png = await this.service.renderThumbnail(body.canvas, body.data || {});
    res.set({ 'Content-Type': 'image/png', 'Content-Length': png.length });
    res.end(png);
  }

  // ═══════════════════════════════════════════
  // 批量生成
  // ═══════════════════════════════════════════

  /**
   * 批量生成证书 PDF（ZIP 打包下载）。
   * Body: { canvas, rows: TemplateData[], mode?, dpi?, filenameField? }
   * 限制：单次最多 200 条。
   */
  @Post('batch-generate')
  @RequirePermission(Permissions.TEMPLATE_MANAGE)
  async batchGenerate(
    @Body() body: {
      canvas: CanvasDef;
      rows: TemplateData[];
      mode?: RenderMode;
      dpi?: number;
      filenameField?: string;
    },
    @Res() res: Response,
  ) {
    if (!body.rows || body.rows.length === 0) {
      res.status(400).json({ message: '数据行不能为空' });
      return;
    }
    if (body.rows.length > 200) {
      res.status(400).json({ message: '单次批量生成上限 200 条' });
      return;
    }

    try {
      const zip = await this.service.batchGeneratePdf(
        body.canvas,
        body.rows,
        { mode: body.mode, dpi: body.dpi, filenameField: body.filenameField },
      );
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="certificates_batch.zip"',
        'Content-Length': zip.length,
      });
      res.end(zip);
    } catch (err) {
      res.status(500).json({ message: '批量生成失败: ' + (err as Error).message });
    }
  }

}
