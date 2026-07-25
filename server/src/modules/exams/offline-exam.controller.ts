import { Controller, Get, Post, Put, Param, Body, Req, ParseIntPipe, Res } from '@nestjs/common';
import { OfflineExamService } from './offline-exam.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

/**
 * 线下笔试考试 API
 * 路由前缀：/api/offline-exams
 */
@Controller('api/offline-exams')
export class OfflineExamController {
  constructor(private service: OfflineExamService) {}

  // ── 状态机 ──

  @Put(':id/publish')
  @RequirePermission(Permissions.EXAM_CREATE)
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.service.publish(id);
  }

  @Put(':id/start-grading')
  @RequirePermission(Permissions.GRADING_MANUAL)
  startGrading(@Param('id', ParseIntPipe) id: number) {
    return this.service.startGrading(id);
  }

  @Put(':id/start-score-entry')
  @RequirePermission(Permissions.GRADING_MANUAL)
  startScoreEntry(@Param('id', ParseIntPipe) id: number) {
    return this.service.startScoreEntry(id);
  }

  @Put(':id/confirm-scores')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  confirmScores(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { approvalNote?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.confirmScores(id, userId, data.approvalNote);
  }

  @Put(':id/publish-scores')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  publishScores(@Param('id', ParseIntPipe) id: number) {
    return this.service.publishScores(id);
  }

  // ── 成绩录入 ──

  @Post(':id/scores')
  @RequirePermission(Permissions.GRADING_MANUAL)
  enterScore(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      sessionId: number;
      scoreByType: Record<string, number>;
      graderName?: string;
      graderId?: number;
      gradedAt?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.enterScore(id, data.sessionId, {
      scoreByType: data.scoreByType,
      graderName: data.graderName,
      graderId: data.graderId ?? null,
      gradedAt: data.gradedAt,
      enteredBy: userId,
    });
  }

  @Post(':id/scores/batch')
  @RequirePermission(Permissions.GRADING_MANUAL)
  batchImport(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      entries: Array<{
        studentId: number;
        scoreByType: Record<string, number>;
        graderName?: string;
        gradedAt?: string;
      }>;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.batchImportScores(id, data.entries, userId);
  }

  @Get(':id/scores')
  @RequirePermission(Permissions.EXAM_RESULT_VIEW)
  getScores(@Param('id', ParseIntPipe) id: number) {
    return this.service.getScoreEntries(id);
  }

  @Get(':id/audit-logs')
  @RequirePermission(Permissions.EXAM_RESULT_VIEW)
  getAuditLogs(@Param('id', ParseIntPipe) id: number) {
    return this.service.getAuditLogs(id);
  }

  // ── 缺考 ──

  @Put(':id/sessions/:sessionId/absent')
  @RequirePermission(Permissions.GRADING_MANUAL)
  markAbsent(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() data: { absent: boolean },
  ) {
    return this.service.markAbsent(id, sessionId, data.absent);
  }

  // ── 座位 ──

  @Post(':id/assign-seats')
  @RequirePermission(Permissions.EXAM_EDIT)
  assignSeats(
    @Param('id', ParseIntPipe) id: number,
    @Body() data?: { startFrom?: number },
  ) {
    return this.service.assignSeats(id, data);
  }

  @Get(':id/seat-table')
  @RequirePermission(Permissions.EXAM_VIEW)
  getSeatTable(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSeatTable(id);
  }

  @Get(':id/seat-table/excel')
  @RequirePermission(Permissions.EXAM_VIEW)
  async exportSeatExcel(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const buffer = await this.service.exportSeatTableExcel(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=seat_table.xlsx');
    res.send(buffer);
  }

  @Get(':id/seat-table/pdf')
  @RequirePermission(Permissions.EXAM_VIEW)
  async exportSeatPdf(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const buffer = await this.service.exportSeatTablePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=seat_table.pdf');
    res.send(buffer);
  }

  // ── 补考 ──

  @Post(':id/retake')
  @RequirePermission(Permissions.EXAM_CREATE)
  createRetake(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { startTime: string; endTime: string; durationMinutes?: number; locations?: any },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.service.createRetake(id, { ...data, createdBy: userId });
  }

  @Get(':id/retake-info')
  @RequirePermission(Permissions.EXAM_VIEW)
  getRetakeInfo(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRetakeInfo(id);
  }

  // ── 复核 ──

  @Put(':id/scores/:sessionId/review')
  @RequirePermission(Permissions.GRADING_PUBLISH)
  reviewScore(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() data: { reviewerName: string; reviewerId?: number; reviewNote?: string; approved: boolean },
  ) {
    return this.service.reviewScore(id, sessionId, data);
  }

  // ── 导入模板 ──

  @Get(':id/import-template')
  @RequirePermission(Permissions.GRADING_MANUAL)
  async getImportTemplate(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const data = await this.service.getImportTemplate(id);
    // 返回 CSV 格式
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=score_import_template.csv');
    res.send('﻿' + data); // BOM for Excel UTF-8
  }
}
