import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PapersService } from './papers.service.js';

@Controller('api/papers')
export class PapersController {
  constructor(private service: PapersService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post('generate')
  generate(@Body() data: any) { return this.service.generate(data); }

  @Put(':id/finalize')
  finalize(@Param('id', ParseIntPipe) id: number) { return this.service.finalize(id); }

  @Put(':id/promote')
  promote(@Param('id', ParseIntPipe) id: number) { return this.service.promoteToOfficial(id); }

  @Post(':id/upload-word')
  @UseInterceptors(FileInterceptor('file'))
  uploadWord(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadWord(id, file);
  }

  @Get(':id/export-word')
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

  @Get(':id/export-pdf')
  async exportPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const pdf = await this.service.generateExportPdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="paper-${id}.pdf"`);
      res.send(pdf);
    } catch {
      // Fallback: return HTML if PDF generation fails
      const html = await this.service.generateExportHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    }
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
