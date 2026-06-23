import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Req, Res, ParseIntPipe, BadRequestException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideoCoursesService } from './video-courses.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/video-courses')
export class VideoCoursesController {
  constructor(private service: VideoCoursesService) {}

  @Get()
  @RequirePermission(P.COURSE_VIEW)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      type, keyword,
    });
  }

  @Get(':id')
  @RequirePermission(P.COURSE_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post('upload')
  @RequirePermission(P.COURSE_EDIT)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        cb(new BadRequestException('仅支持视频文件'), false);
      } else cb(null, true);
    },
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const uploadDir = path.resolve('uploads/videos');
    await fs.mkdir(uploadDir, { recursive: true });
    // 去除文件名中的非 ASCII 字符（避免 MySQL 编码问题）
    const safeName = file.originalname.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '_').replace(/_{2,}/g, '_');
    const fileName = `${Date.now()}-${safeName || 'video'}`;
    await fs.writeFile(path.join(uploadDir, fileName), file.buffer);
    return { url: `/uploads/videos/${fileName}`, fileName: file.originalname };
  }

  @Post()
  @RequirePermission(P.COURSE_EDIT)
  create(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.create(data, userId);
  }

  @Put(':id')
  @RequirePermission(P.COURSE_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.update(id, data, userId);
  }

  @Delete(':id')
  @RequirePermission(P.COURSE_DELETE)
  delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.service.delete(id, userId);
  }

  @Get(':id/logs')
  @RequirePermission(P.COURSE_VIEW)
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.service.getLogs(id);
  }

  // ── 学员端：视频播放流 ──
  @Get(':id/stream')
  async stream(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const video = await this.service.findOne(id);
    if (!video.url) { res.status(404).send('视频文件未上传'); return; }
    const filePath = path.resolve('.' + video.url);
    let stat: fsSync.Stats;
    try {
      stat = await fs.stat(filePath);
    } catch {
      res.status(404).send('视频文件未找到');
      return;
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4', '.webm': 'video/webm',
      '.ogg': 'video/ogg', '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
    };

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeMap[ext] || 'video/mp4',
      });
      const stream = fsSync.createReadStream(filePath, { start, end, highWaterMark: 65536 });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'video/mp4',
        'Content-Length': fileSize,
      });
      const stream = fsSync.createReadStream(filePath, { highWaterMark: 65536 });
      stream.pipe(res);
    }
  }

  // ── 学员端：进度 ──
  @Get(':id/progress')
  async getProgress(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.getProgress(id, studentId);
  }

  @Post(':id/progress')
  async reportProgress(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() body: any) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.reportProgress(id, studentId, body);
  }

  // ── 学员端：可见视频列表 + 学时统计 ──
  @Get('student/visible')
  async findVisible(@Req() req: any) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.findVisibleForStudent(studentId);
  }
}
