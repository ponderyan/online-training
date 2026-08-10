import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, UploadedFile, UseInterceptors, Res, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PapersService } from './papers.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import { ResourceAccessService } from '../../common/services/resource-access.service.js';

@Controller('api/papers')
export class PapersController {
  constructor(private service: PapersService, private systemConfig: SystemConfigService, private resourceAccess: ResourceAccessService) {}

  @Get()
  @RequirePermission(Permissions.PAPER_EDIT)
  findAll(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string, @Query('status') status?: string, @Query('subjectId') subjectId?: string, @Query('orgId') orgId?: string, @Query('sort') sort?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      keyword: keyword || undefined,
      status: status || undefined,
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      filterOrgId: orgId ? parseInt(orgId) : undefined,
      sort: sort || undefined,
      userOrgId: req.user?.orgId ?? null,
      userRoles: req.user?.roles,
    });
  }

  @Get('export-preview/:id')
  @RequirePermission(Permissions.PAPER_VIEW)
  async exportPreview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Get(':id')
  @RequirePermission(Permissions.PAPER_EDIT)
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Post()
  @RequirePermission(Permissions.PAPER_GENERATE)
  async create(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const userOrgId = req.user?.orgId ?? null;
    const userRoles: string[] = req.user?.roles || [];
    if (userOrgId && !userRoles.includes('SUPER_ADMIN')) {
      const allow = await this.systemConfig.getBoolean('allow_org_own_bank');
      if (!allow) throw new ForbiddenException('当前系统不允许机构自建题库，无法组卷');
    }
    return this.service.create({ ...data, createdBy: userId, orgId: userOrgId });
  }

  @Post('generate')
  @RequirePermission(Permissions.PAPER_GENERATE)
  async generate(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const userOrgId = req.user?.orgId ?? null;
    const userRoles: string[] = req.user?.roles || [];
    if (userOrgId && !userRoles.includes('SUPER_ADMIN')) {
      const allow = await this.systemConfig.getBoolean('allow_org_own_bank');
      if (!allow) throw new ForbiddenException('当前系统不允许机构自建题库，无法组卷');
    }
    const count = Math.min(Math.max(parseInt(data.count) || 1, 1), 5);
    if (count === 1) {
      return this.service.generate({ ...data, createdBy: userId, orgId: userOrgId });
    }
    const results: any[] = [];
    for (let i = 0; i < count; i++) {
      const paper = await this.service.generate({
        ...data,
        name: `${data.name}（${String.fromCharCode(65 + i)}卷）`,
        createdBy: userId,
        orgId: userOrgId,
        excludeQuestionIds: [...(data.excludeQuestionIds || []), ...results.flatMap(r => (r.questions || []).map((q: any) => q.questionId))],
      });
      results.push(paper);
    }
    return { batch: true, count: results.length, papers: results };
  }

  @Put(':id/finalize')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  async finalize(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.finalize(id);
  }

  @Put(':id/promote')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  async promote(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.promoteToOfficial(id);
  }

  @Put(':id/submit-review')
  @RequirePermission(Permissions.PAPER_EDIT)
  async submitReview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.submitForReview(id);
  }

  @Put(':id/approve-review')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  async approveReview(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.approveReview(id);
  }

  @Put(':id/reject-review')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  async rejectReview(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.rejectReview(id, body?.reason);
  }

  @Post(':id/upload-word')
  @RequirePermission(Permissions.PAPER_EDIT)
  @UseInterceptors(FileInterceptor('file'))
  async uploadWord(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.uploadWord(id, file);
  }

  @Get(':id/export-word')
  @RequirePermission(Permissions.PAPER_DOWNLOAD)
  async exportWord(@Req() req: any, @Res() res: Response, @Param('id', ParseIntPipe) id: number) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const docx = await this.service.generateExportDocx(id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="paper-${id}.docx"`, 'Content-Length': docx.length });
    res.end(docx);
  }

  @Get(':id/export-answer-sheet')
  @RequirePermission(Permissions.PAPER_ANSWER_SHEET)
  async exportAnswerSheet(@Req() req: any, @Res() res: Response, @Param('id', ParseIntPipe) id: number) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const docx = await this.service.generateAnswerSheetDocx(id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="answer-sheet-${id}.docx"`, 'Content-Length': docx.length });
    res.end(docx);
  }

  @Get(':id/export-pdf')
  @RequirePermission(Permissions.PAPER_DOWNLOAD)
  async exportPdf(@Req() req: any, @Res() res: Response, @Param('id', ParseIntPipe) id: number) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const pdf = await this.service.generateExportPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="paper-${id}.pdf"`, 'Content-Length': pdf.length });
    res.end(pdf);
  }

  @Delete(':id')
  @RequirePermission(Permissions.PAPER_EDIT)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Delete(':id/questions/:pqId')
  @RequirePermission(Permissions.PAPER_EDIT)
  async removeQuestion(@Param('id', ParseIntPipe) id: number, @Param('pqId', ParseIntPipe) pqId: number, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.removeQuestion(id, pqId);
  }

  @Post(':id/questions')
  @RequirePermission(Permissions.PAPER_EDIT)
  async addQuestion(@Param('id', ParseIntPipe) id: number, @Body() data: { questionId: number; score: number; typeSection: string }, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.addQuestion(id, data);
  }

  @Post(':id/questions/:pqId/replace')
  @RequirePermission(Permissions.PAPER_EDIT)
  async replaceQuestion(@Param('id', ParseIntPipe) id: number, @Param('pqId', ParseIntPipe) pqId: number, @Body() data: { questionId: number }, @Req() req: any) {
    await this.resourceAccess.assertPaperAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.replaceQuestion(id, pqId, data.questionId);
  }

  // ═══ 归档 & 批量操作 ═══

  @Post(':id/archive')
  @RequirePermission(Permissions.PAPER_EDIT)
  archive(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.archive(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Post(':id/restore')
  @RequirePermission(Permissions.PAPER_EDIT)
  restore(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.restore(id, req.user?.orgId ?? null, req.user?.roles);
  }

  @Post('batch/status')
  @RequirePermission(Permissions.PAPER_EDIT)
  batchStatus(@Body() body: { ids: number[]; status: string }, @Req() req: any) {
    return this.service.batchUpdateStatus(body.ids, body.status, req.user?.orgId ?? null, req.user?.roles);
  }

  @Post('batch/delete')
  @RequirePermission(Permissions.PAPER_EDIT)
  batchDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.service.batchDelete(body.ids, req.user?.orgId ?? null, req.user?.roles);
  }
}
