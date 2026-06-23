import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseIntPipe, UseInterceptors, UploadedFile,
  Req, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { CourseVideosService } from './course-videos.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

const UPLOAD_DIR = path.resolve('uploads/videos');

@Controller('api/courses/:courseId/videos')
export class CourseVideosController {
  constructor(private service: CourseVideosService) {}

  @Get()
  @RequirePermission(P.COURSE_VIEW)
  findAll(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.service.findAll(courseId);
  }

  @Get(':id')
  @RequirePermission(P.COURSE_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission(P.COURSE_EDIT)
  create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { title: string; url: string; duration?: number; requiredPct?: number; sortOrder?: number; isPublic?: boolean },
  ) {
    return this.service.create(courseId, body);
  }

  @Put(':id')
  @RequirePermission(P.COURSE_EDIT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; url?: string; duration?: number; requiredPct?: number; sortOrder?: number; isPublic?: boolean },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(P.COURSE_EDIT)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  @Put('reorder')
  @RequirePermission(P.COURSE_EDIT)
  reorder(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { videoIds: number[] },
  ) {
    return this.service.reorder(courseId, body.videoIds);
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
  async upload(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; duration?: string },
  ) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fs.writeFile(filePath, file.buffer);

    return this.service.create(courseId, {
      title: body.title || file.originalname,
      url: `/uploads/videos/${fileName}`,
      duration: body.duration ? parseInt(body.duration) : 0,
    });
  }

  @Get(':id/stream')
  @RequirePermission(P.COURSE_VIEW)
  async stream(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const video = await this.service.findOne(id);
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

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4', '.webm': 'video/webm',
        '.ogg': 'video/ogg', '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
      };

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeMap[ext] || 'video/mp4',
      });
      const stream = require('fs').createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4', '.webm': 'video/webm',
        '.ogg': 'video/ogg', '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'video/mp4',
        'Content-Length': fileSize,
      });
      const stream = require('fs').createReadStream(filePath);
      stream.pipe(res);
    }
  }

  // 进度
  @Get(':id/progress')
  async getProgress(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.getProgress(id, studentId);
  }

  @Post(':id/progress')
  async reportProgress(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: { progress: number; lastPosition: number; completed?: boolean },
  ) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.reportProgress(id, studentId, body);
  }
}
