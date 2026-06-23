import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, UseInterceptors, UploadedFile, Query, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs/promises';
import { AttachmentsService } from './attachments.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/attachments')
export class AttachmentsController {
  constructor(private service: AttachmentsService) {}

  @Post('upload')
  @RequirePermission(Permissions.STUDENT_EDIT)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId: string; category: string; description?: string },
  ) {
    return this.service.upload(parseInt(body.userId), file, body.category, body.description);
  }

  @Get()
  @RequirePermission(Permissions.STUDENT_CREATE)
  async findByUser(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('category') category?: string,
  ) {
    return this.service.findByUser(userId, category);
  }

  @Get(':id/file')
  @RequirePermission(Permissions.STUDENT_CREATE)
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const att = await this.service.findOne(id);
    const filePath = this.service.getFilePath(att);
    res.set({
      'Content-Type': att.mimeType,
      'Content-Disposition': `inline; filename="${att.fileName}"`,
    });
    const content = await fs.readFile(filePath);
    res.end(content);
  }

  @Delete(':id')
  @RequirePermission(Permissions.STUDENT_EDIT)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  @Post(':id/verify')
  @RequirePermission(Permissions.STUDENT_EDIT)
  verify(@Param('id', ParseIntPipe) id: number, @Body() data: { verifiedBy: number }) {
    return this.service.verify(id, data.verifiedBy);
  }
}
