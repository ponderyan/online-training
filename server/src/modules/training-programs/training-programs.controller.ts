import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, UploadedFile, UseInterceptors, Req, Res, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { TrainingProgramsService } from './training-programs.service.js';
import { BatchesService } from './batches.service.js';
import { SchedulesService } from '../courses/schedules.service.js';
import { EvidenceService } from './evidence.service.js';
import { AttendanceService } from './attendance.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/training-programs')
export class TrainingProgramsController {
  constructor(
    private service: TrainingProgramsService,
    private batchesService: BatchesService,
    private schedulesService: SchedulesService,
    private evidenceService: EvidenceService,
    private attendanceService: AttendanceService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string, @Query('status') status?: string, @Query('subjectId') subjectId?: string) {
    return this.service.findAll({ page: page ? parseInt(page) : undefined, pageSize: pageSize ? parseInt(pageSize) : undefined, keyword, status, subjectId: subjectId ? parseInt(subjectId) : undefined });
  }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @RequirePermission(P.PROGRAM_CREATE)
  create(@Body() data: any) { return this.service.create(data); }
  @Put(':id') @RequirePermission(P.PROGRAM_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }
  @Delete(':id') @RequirePermission(P.PROGRAM_DELETE)
  delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
  @Put(':id/status') @RequirePermission(P.PROGRAM_EDIT)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() data: { status: string; reason?: string }, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.service.updateStatus(id, data.status, userId, data.reason);
  }
  @Post(':id/enroll') @RequirePermission(P.PROGRAM_ENROLL)
  enroll(@Param('id', ParseIntPipe) id: number, @Body() data: { studentIds: number[]; agencyId?: number }) { return this.service.enrollStudents(id, data.studentIds, data.agencyId); }
  @Get(':id/schedules') @RequirePermission(P.SCHEDULE_VIEW)
  getSchedules(@Param('id', ParseIntPipe) id: number) { return this.schedulesService.findByProgram(id); }

  @Get(':id/available-actions') @RequirePermission(P.PROGRAM_VIEW)
  getAvailableActions(@Param('id', ParseIntPipe) id: number) { return this.service.getAvailableActions(id); }

  @Get(':id/status-logs') @RequirePermission(P.PROGRAM_VIEW)
  getStatusLogs(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.programStatusLog.findMany({
      where: { programId: id }, orderBy: { createdAt: 'desc' },
      include: { operator: { select: { id: true, displayName: true } } },
    });
  }

  // ── Phase B: 签到表 ──
  @Get(':id/generate-signin-sheet') @RequirePermission(P.PROGRAM_VIEW)
  async generateSignin(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, fileName } = await this.evidenceService.generateSigninSheet(id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Post(':id/evidences') @RequirePermission(P.PROGRAM_EDIT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEvidence(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.evidenceService.upload(id, file, body.evidenceType, body.notes, userId);
  }

  @Get(':id/evidences') @RequirePermission(P.PROGRAM_VIEW)
  getEvidences(@Param('id', ParseIntPipe) id: number) { return this.evidenceService.findByProgram(id); }

  @Get(':id/evidences/:evidenceId/file') @RequirePermission(P.PROGRAM_VIEW)
  async downloadEvidence(@Param('id', ParseIntPipe) programId: number, @Param('evidenceId', ParseIntPipe) evidenceId: number, @Res() res: Response) {
    const evidence = await this.evidenceService.findById(evidenceId);
    if (!evidence || evidence.programId !== programId) throw new NotFoundException('文件不存在');
    const fileExists = await import('fs').then(fs => fs.existsSync(evidence.fileUrl));
    if (!fileExists) throw new NotFoundException('文件已丢失');
    res.setHeader('Content-Type', evidence.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.fileName)}"`);
    res.sendFile(evidence.fileUrl);
  }

  @Delete(':id/evidences/:evidenceId') @RequirePermission(P.PROGRAM_EDIT)
  deleteEvidence(@Param('evidenceId', ParseIntPipe) evidenceId: number) { return this.evidenceService.delete(evidenceId); }

  // ── Phase B: 出勤记录 ──
  @Get(':id/attendance') @RequirePermission(P.PROGRAM_VIEW)
  getAttendance(@Param('id', ParseIntPipe) id: number) { return this.attendanceService.getByProgram(id); }

  @Put(':id/attendance/:studentId') @RequirePermission(P.PROGRAM_EDIT)
  updateAttendance(@Param('id', ParseIntPipe) id: number, @Param('studentId', ParseIntPipe) studentId: number, @Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || 1;
    return this.attendanceService.update(id, studentId, data, userId);
  }

  // Phase 1d: 全链审计
  @Get(':id/audit-chain') @RequirePermission(P.PROGRAM_VIEW)
  async getAuditChain(@Param('id', ParseIntPipe) id: number) {
    const [program, evidences, attendanceList, filingRecords, certificates] = await Promise.all([
      this.prisma.trainingProgram.findUnique({ where: { id } }),
      this.prisma.businessEvidence.findMany({ where: { programId: id, evidenceType: 'ATTENDANCE_SHEET' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.attendanceRecord.findMany({ where: { programId: id }, include: { student: { select: { displayName: true, organization: true } } } }),
      this.prisma.enrollmentAgencyEnrollment.findFirst({ where: { programId: id }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.certificate.findMany({ where: { programId: id }, include: { traces: true } }),
    ]);

    const avgRate = attendanceList.length > 0
      ? Math.round(attendanceList.reduce((s, r) => s + (r.attendanceRate || 0), 0) / attendanceList.length)
      : 0;

    return {
      program,
      evidences: { total: evidences.length, items: evidences },
      attendance: { records: attendanceList, avgRate },
      filing: filingRecords,
      certificates: { issued: certificates.length, items: certificates },
    };
  }

  // ═══════════════════════════════
  //  批次管理（ProgramBatch）
  // ═══════════════════════════════

  @Get(':id/batches')
  @RequirePermission(P.PROGRAM_VIEW)
  findBatches(@Param('id', ParseIntPipe) id: number) {
    return this.batchesService.findByProgram(id);
  }

  @Post(':id/batches')
  @RequirePermission(P.PROGRAM_CREATE)
  createBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name: string; headTeacherId?: number; startedAt?: string; endedAt?: string; description?: string; note?: string },
  ) { return this.batchesService.create(id, data); }

  @Get('batches/:batchId')
  @RequirePermission(P.PROGRAM_VIEW)
  findBatch(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.batchesService.findOne(batchId);
  }

  @Put('batches/:batchId')
  @RequirePermission(P.PROGRAM_EDIT)
  updateBatch(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: any) {
    return this.batchesService.update(batchId, data);
  }

  @Delete('batches/:batchId')
  @RequirePermission(P.PROGRAM_DELETE)
  deleteBatch(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.batchesService.remove(batchId);
  }

  @Put('batches/:batchId/head-teacher')
  @RequirePermission(P.PROGRAM_EDIT)
  setBatchHeadTeacher(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: { headTeacherId: number | null }) {
    return this.batchesService.setHeadTeacher(batchId, data.headTeacherId);
  }

  @Get('batches/:batchId/members')
  @RequirePermission(P.PROGRAM_VIEW)
  getBatchMembers(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.batchesService.getMembers(batchId);
  }

  @Post('batches/:batchId/members')
  @RequirePermission(P.PROGRAM_ENROLL)
  addBatchMembers(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: { userIds: number[] }) {
    return this.batchesService.addMembers(batchId, data.userIds);
  }

  @Delete('batches/:batchId/members/:userId')
  @RequirePermission(P.PROGRAM_ENROLL)
  removeBatchMember(@Param('batchId', ParseIntPipe) batchId: number, @Param('userId', ParseIntPipe) userId: number) {
    return this.batchesService.removeMember(batchId, userId);
  }
}
