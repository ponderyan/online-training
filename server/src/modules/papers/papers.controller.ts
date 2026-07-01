import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PapersService } from './papers.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/papers')
export class PapersController {
  constructor(private service: PapersService) {}

  @Get()
  @RequirePermission(Permissions.PAPER_EDIT)
  findAll(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
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
  create(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.create({
      ...data,
      createdBy: userId,
      orgId: req.user?.orgId ?? null,
    });
  }

  @Post('generate')
  @RequirePermission(Permissions.PAPER_GENERATE)
  generate(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.generate({
      ...data,
      createdBy: userId,
      orgId: req.user?.orgId ?? null,
    });
  }

  @Put(':id/finalize')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  finalize(@Param('id', ParseIntPipe) id: number) { return this.service.finalize(id); }

  @Put(':id/promote')
  @RequirePermission(Permissions.PAPER_PUBLISH)
  promote(@Param('id', ParseIntPipe) id: number) { return this.service.promoteToOfficial(id); }

  @Post(':id/upload-word')
  @RequirePermission(Permissions.PAPER_EDIT)
  @UseInterceptors(FileInterceptor('file'))
  uploadWord(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadWord(id, file);
  }

  @Get(':id/export-word')
  @RequirePermission(Permissions.PAPER_DOWNLOAD)
  async exportWord(@Param('id', ParseIntPipe) id: number) { return this.service.generateExportHtml(id); }

  @Get(':id/export-answer-sheet')
  @RequirePermission(Permissions.PAPER_ANSWER_SHEET)
  async exportAnswerSheet(@Param('id', ParseIntPipe) id: number) { return this.service.generateAnswerSheetDocx(id); }

  @Get(':id/export-pdf')
  @RequirePermission(Permissions.PAPER_DOWNLOAD)
  async exportPdf(@Res() res: Response, @Param('id', ParseIntPipe) id: number) {
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
  removeQuestion(@Param('id', ParseIntPipe) id: number, @Param('pqId', ParseIntPipe) pqId: number) {
    return this.service.removeQuestion(id, pqId);
  }

  @Post(':id/questions')
  @RequirePermission(Permissions.PAPER_EDIT)
  addQuestion(@Param('id', ParseIntPipe) id: number, @Body() data: { questionId: number; score: number; typeSection: string }) {
    return this.service.addQuestion(id, data);
  }

  @Post(':id/questions/:pqId/replace')
  @RequirePermission(Permissions.PAPER_EDIT)
  replaceQuestion(@Param('id', ParseIntPipe) id: number, @Param('pqId', ParseIntPipe) pqId: number, @Body() data: { questionId: number }) {
    return this.service.replaceQuestion(id, pqId, data.questionId);
  }
}
