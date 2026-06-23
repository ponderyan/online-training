import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
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
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get('export-preview/:id')
  @RequirePermission(Permissions.PAPER_VIEW)
  async exportPreview(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id')
  @RequirePermission(Permissions.PAPER_EDIT)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @RequirePermission(Permissions.PAPER_GENERATE)
  create(@Body() data: any) { return this.service.create(data); }

  @Post('generate')
  @RequirePermission(Permissions.PAPER_GENERATE)
  generate(@Body() data: any) { return this.service.generate(data); }

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
  async exportWord(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const docx = await this.service.generateExportDocx(id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="paper-${id}.docx"`);
      res.send(docx);
    } catch {
      const html = await this.service.generateExportHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="paper-${id}.html"`);
      res.send(html);
    }
  }

  @Get(':id/export-answer-sheet')
  @RequirePermission(Permissions.PAPER_ANSWER_SHEET)
  async exportAnswerSheet(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const docx = await this.service.generateAnswerSheetDocx(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="answer-sheet-${id}.docx"`);
    res.send(docx);
  }

  @Get(':id/export-pdf')
  @RequirePermission(Permissions.PAPER_DOWNLOAD)
  async exportPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const pdf = await this.service.generateExportPdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="paper-${id}.pdf"`);
      res.send(pdf);
    } catch {
      const html = await this.service.generateExportHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    }
  }

  @Delete(':id')
  @RequirePermission(Permissions.PAPER_EDIT)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

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
  replaceQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Param('pqId', ParseIntPipe) pqId: number,
    @Body() data: { newQuestionId: number },
  ) {
    return this.service.replaceQuestion(id, pqId, data.newQuestionId);
  }
}
