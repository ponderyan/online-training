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
import { ResourceAccessService } from '../../common/services/resource-access.service.js';

@Controller('api/training-programs')
export class TrainingProgramsController {
  constructor(
    private service: TrainingProgramsService,
    private batchesService: BatchesService,
    private schedulesService: SchedulesService,
    private evidenceService: EvidenceService,
    private attendanceService: AttendanceService,
    private prisma: PrismaService,
    private resourceAccess: ResourceAccessService,
  ) {}

  @Get()
  @RequirePermission(P.PROGRAM_VIEW)
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string, @Query('status') status?: string, @Query('subjectId') subjectId?: string, @Req() req?: any) {
    return this.service.findAll({ page: page ? parseInt(page) : undefined, pageSize: pageSize ? parseInt(pageSize) : undefined, keyword, status, subjectId: subjectId ? parseInt(subjectId) : undefined, userOrgId: req?.user?.orgId ?? null, userRoles: req?.user?.roles });
  }

  @Get(':id')
  @RequirePermission(P.PROGRAM_VIEW)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.findOne(id);
  }

  @Post() @RequirePermission(P.PROGRAM_CREATE)
  create(@Body() data: any, @Req() req?: any) { return this.service.create(data, req?.user?.orgId ?? null); }

  @Put(':id') @RequirePermission(P.PROGRAM_EDIT)
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.update(id, data);
  }

  @Delete(':id') @RequirePermission(P.PROGRAM_DELETE)
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.delete(id);
  }

  @Put(':id/status') @RequirePermission(P.PROGRAM_EDIT)
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() data: { status: string; reason?: string }, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.service.updateStatus(id, data.status, userId, data.reason);
  }

  @Post(':id/enroll') @RequirePermission(P.PROGRAM_ENROLL)
  async enroll(@Param('id', ParseIntPipe) id: number, @Body() data: { studentIds: number[]; agencyId?: number }, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.enrollStudents(id, data.studentIds, data.agencyId);
  }

  @Get(':id/schedules') @RequirePermission(P.SCHEDULE_VIEW)
  async getSchedules(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.schedulesService.findByProgram(id);
  }

  @Get(':id/available-actions') @RequirePermission(P.PROGRAM_VIEW)
  async getAvailableActions(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.getAvailableActions(id);
  }

  @Get(':id/status-logs') @RequirePermission(P.PROGRAM_VIEW)
  async getStatusLogs(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.prisma.programStatusLog.findMany({
      where: { programId: id }, orderBy: { createdAt: 'desc' },
      include: { operator: { select: { id: true, displayName: true } } },
    });
  }

  // ── Phase B: 签到表 ──
  @Get(':id/generate-signin-sheet') @RequirePermission(P.PROGRAM_VIEW)
  async generateSignin(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const { buffer, fileName } = await this.evidenceService.generateSigninSheet(id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Post(':id/evidences') @RequirePermission(P.PROGRAM_EDIT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEvidence(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const userId = req.user?.sub || req.user?.id || 1;
    return this.evidenceService.upload(id, file, body.evidenceType, body.notes, userId);
  }

  @Get(':id/evidences') @RequirePermission(P.PROGRAM_VIEW)
  async getEvidences(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.evidenceService.findByProgram(id);
  }

  @Get(':id/evidences/:evidenceId/file') @RequirePermission(P.PROGRAM_VIEW)
  async downloadEvidence(@Param('id', ParseIntPipe) programId: number, @Param('evidenceId', ParseIntPipe) evidenceId: number, @Req() req: any, @Res() res: Response) {
    await this.resourceAccess.assertProgramAccess(programId, req.user?.orgId ?? null, req.user?.roles);
    const evidence = await this.evidenceService.findById(evidenceId);
    if (!evidence || evidence.programId !== programId) throw new NotFoundException('文件不存在');
    const fileExists = await import('fs').then(fs => fs.existsSync(evidence.fileUrl));
    if (!fileExists) throw new NotFoundException('文件已丢失');
    res.setHeader('Content-Type', evidence.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.fileName)}"`);
    res.sendFile(evidence.fileUrl);
  }

  @Delete(':id/evidences/:evidenceId') @RequirePermission(P.PROGRAM_EDIT)
  async deleteEvidence(@Param('id', ParseIntPipe) programId: number, @Param('evidenceId', ParseIntPipe) evidenceId: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(programId, req.user?.orgId ?? null, req.user?.roles);
    return this.evidenceService.delete(evidenceId);
  }

  // ── Phase B: 出勤记录 ──
  @Get(':id/attendance') @RequirePermission(P.PROGRAM_VIEW)
  async getAttendance(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.attendanceService.getByProgram(id);
  }

  @Put(':id/attendance/:studentId') @RequirePermission(P.PROGRAM_EDIT)
  async updateAttendance(@Param('id', ParseIntPipe) id: number, @Param('studentId', ParseIntPipe) studentId: number, @Body() data: any, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    const userId = req.user?.sub || req.user?.id || 1;
    return this.attendanceService.update(id, studentId, data, userId);
  }

  // Phase 1d: 全链审计
  @Get(':id/audit-chain') @RequirePermission(P.PROGRAM_VIEW)
  async getAuditChain(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
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
  //   仪表盘
  // ═══════════════════════════════

  @Get(':id/dashboard')
  @RequirePermission(P.PROGRAM_VIEW)
  async getDashboard(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.service.getDashboard(id);
  }

  // ═══════════════════════════════
  //  批次管理（ProgramBatch）
  // ═══════════════════════════════

  @Get(':id/batches')
  @RequirePermission(P.PROGRAM_VIEW)
  async findBatches(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.batchesService.findByProgram(id);
  }

  @Post(':id/batches')
  @RequirePermission(P.PROGRAM_CREATE)
  async createBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name: string; headTeacherId?: number; startedAt?: string; endedAt?: string; description?: string; note?: string },
    @Req() req: any,
  ) {
    await this.resourceAccess.assertProgramAccess(id, req.user?.orgId ?? null, req.user?.roles);
    return this.batchesService.create(id, data);
  }

  @Get('batches/:batchId')
  @RequirePermission(P.PROGRAM_VIEW)
  async findBatch(@Param('batchId', ParseIntPipe) batchId: number, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.findOne(batchId);
  }

  @Put('batches/:batchId')
  @RequirePermission(P.PROGRAM_EDIT)
  async updateBatch(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: any, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.update(batchId, data);
  }

  @Delete('batches/:batchId')
  @RequirePermission(P.PROGRAM_DELETE)
  async deleteBatch(@Param('batchId', ParseIntPipe) batchId: number, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.remove(batchId);
  }

  @Put('batches/:batchId/head-teacher')
  @RequirePermission(P.PROGRAM_EDIT)
  async setBatchHeadTeacher(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: { headTeacherId: number | null }, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.setHeadTeacher(batchId, data.headTeacherId);
  }

  @Get('batches/:batchId/members')
  @RequirePermission(P.PROGRAM_VIEW)
  async getBatchMembers(@Param('batchId', ParseIntPipe) batchId: number, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.getMembers(batchId);
  }

  @Post('batches/:batchId/members')
  @RequirePermission(P.PROGRAM_ENROLL)
  async addBatchMembers(@Param('batchId', ParseIntPipe) batchId: number, @Body() data: { userIds: number[] }, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.addMembers(batchId, data.userIds);
  }

  @Delete('batches/:batchId/members/:userId')
  @RequirePermission(P.PROGRAM_ENROLL)
  async removeBatchMember(@Param('batchId', ParseIntPipe) batchId: number, @Param('userId', ParseIntPipe) userId: number, @Req() req: any) {
    await this.assertBatchAccess(batchId, req);
    return this.batchesService.removeMember(batchId, userId);
  }

  // ─── 内部：通过 batchId 反查 programId 做组织校验 ───
  private async assertBatchAccess(batchId: number, req: any) {
    const batch = await this.prisma.programBatch.findUnique({
      where: { id: batchId },
      select: { programId: true },
    });
    if (!batch) throw new NotFoundException('批次不存在');
    await this.resourceAccess.assertProgramAccess(batch.programId, req.user?.orgId ?? null, req.user?.roles);
  }
}
