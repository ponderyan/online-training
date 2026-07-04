import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, Query, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { LearningHoursService } from './learning-hours.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/learning-hours')
export class LearningHoursController {
  constructor(private service: LearningHoursService) {}

  // ── 申报学时（V1 主路由）──
  @Post()
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async submit(@Body() data: {
    studentId: number;
    programId?: number;
    hours: number;
    typeId?: number;
    description?: string;
    note?: string;
    source?: string;
    evidenceUrl?: string;
  }, @Req() req: any) {
    const operatorId = req.user?.sub || req.user?.id;
    const operatorOrgId = req.user?.orgId;
    return this.service.submit(data.studentId, {
      ...data,
      source: data.source || 'OFFLINE',
      operatorId,
      operatorOrgId,
    });
  }

  // ── 查询学时 ──
  @Get()
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async findAll(
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.findAll({
      studentId: studentId ? parseInt(studentId) : undefined,
      status,
      programId: programId ? parseInt(programId) : undefined,
    });
  }

  // ── 学员学时汇总 ──
  @Get('stats')
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async stats(@Req() req: any, @Query('studentId') studentId?: string) {
    const sid = studentId ? parseInt(studentId) : req.user?.id;
    if (!sid) throw new BadRequestException('需要 studentId');
    return this.service.stats(sid);
  }

  // ── 培训班学时统计 ──
  @Get('program/:programId')
  @RequirePermission(P.PROGRAM_VIEW)
  programStats(@Param('programId', ParseIntPipe) programId: number) {
    return this.service.programStats(programId);
  }

  // ── 待审核列表 ──
  @Get('pending')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async getPendingHours(@Query('programId') programId?: string, @Query('source') source?: string) {
    return this.service.getPendingHours(programId ? parseInt(programId) : undefined, source);
  }

  // ── 审核/驳回（V1 主路由）──
  @Patch(':id/review')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: 'approve' | 'reject'; comment?: string },
    @Req() req: any,
  ) {
    const reviewerId = req.user?.id || req.user?.sub;
    const reviewerName = req.user?.displayName || '审核员';
    return this.service.review(id, data.action, reviewerId, data.comment || null);
  }

  // ── 兼容旧路由：批量通过/驳回 ──
  @Post('approve')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async approveHours(@Body() data: { ids: number[]; comment?: string }, @Req() req: any) {
    const reviewerId = req.user?.id || req.user?.sub;
    const results = [];
    for (const id of data.ids) {
      results.push(await this.service.review(id, 'approve', reviewerId, data.comment || null));
    }
    return { reviewed: results.length };
  }

  @Post('reject')
  @RequirePermission(P.LEARNING_HOUR_APPROVE)
  async rejectHours(@Body() data: { ids: number[]; comment: string }, @Req() req: any) {
    const reviewerId = req.user?.id || req.user?.sub;
    const results = [];
    for (const id of data.ids) {
      results.push(await this.service.review(id, 'reject', reviewerId, data.comment));
    }
    return { reviewed: results.length };
  }

  // ── 兼容旧路由：submit ──
  @Post('submit')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async submitLegacy(@Body() data: any, @Req() req: any) {
    const operatorId = req.user?.sub || req.user?.id;
    const operatorOrgId = req.user?.orgId;
    return this.service.submit(data.studentId, {
      ...data,
      source: data.source || 'OFFLINE',
      operatorId,
      operatorOrgId,
    });
  }

  // ── 上传证据 ──
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
