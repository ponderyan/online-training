import { Controller, Get, Post, Param, Body, ParseIntPipe, Query, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { LearningHoursService } from './learning-hours.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/learning-hours')
export class LearningHoursController {
  constructor(private service: LearningHoursService) {}

  @Get()
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async findAll(
    @Req() req: any,
    @Query('programId') programId?: string,
    @Query('source') source?: string,
  ) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.findAll(studentId, {
      programId: programId ? parseInt(programId) : undefined,
      source,
    });
  }

  @Get('stats')
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async stats(@Req() req: any) {
    const studentId = req.user?.id;
    if (!studentId) throw new Error('未登录');
    return this.service.stats(studentId);
  }

  @Get('program/:programId')
  @RequirePermission(P.PROGRAM_VIEW)
  programStats(@Param('programId', ParseIntPipe) programId: number) {
    return this.service.programStats(programId);
  }

  @Get('pending')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async getPendingHours(@Query('programId') programId?: string, @Query('source') source?: string) {
    return this.service.getPendingHours(programId ? parseInt(programId) : undefined, source);
  }

  @Post('submit')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async submit(@Body() data: { studentId: number; programId?: number; hours: number; source: string; evidenceUrl?: string; note?: string }, @Req() req: any) {
    return this.service.submit(data.studentId, data);
  }

  @Post('approve')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async approveHours(@Body() data: { ids: number[]; comment?: string }, @Req() req: any) {
    const reviewerId = req.user?.id || req.user?.sub;
    return this.service.approveHours(data.ids, reviewerId, data.comment);
  }

  @Post('reject')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async rejectHours(@Body() data: { ids: number[]; comment: string }, @Req() req: any) {
    const reviewerId = req.user?.id || req.user?.sub;
    return this.service.rejectHours(data.ids, reviewerId, data.comment);
  }

  @Post('upload-evidence')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'learning-hour-evidence'),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadEvidence(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    return {
      url: `/uploads/learning-hour-evidence/${file.filename}`,
      filename: file.originalname,
    };
  }
}
