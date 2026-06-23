import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { StudentsService } from './students.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/students')
export class StudentsController {
  constructor(private service: StudentsService) {}

  // ═══ 放在 :id 前面，避免路由冲突 ═══

  @Get('export-csv')
  @RequirePermission(Permissions.STUDENT_IMPORT)
  async exportCsv(
    @Res() res: Response,
    @Query('keyword') keyword?: string,
    @Query('groupId') groupId?: string,
    @Query('feeStatus') feeStatus?: string,
  ) {
    const csv = await this.service.exportCsv({
      keyword,
      groupId: groupId ? parseInt(groupId) : undefined,
      feeStatus,
    });
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="students.csv"',
    });
    res.send(csv);
  }

  @Post('batch')
  @RequirePermission(Permissions.STUDENT_IMPORT)
  batchCreate(@Body() data: { students: any[] }) {
    return this.service.batchCreate(data.students);
  }

  @Get('groups/all')
  @RequirePermission(Permissions.STUDENT_GROUP)
  findAllGroups() {
    return this.service.findAllGroups();
  }

  @Post('groups')
  @RequirePermission(Permissions.STUDENT_GROUP)
  createGroup(@Body() data: any) {
    return this.service.createGroup(data);
  }

  @Put('groups/:id')
  @RequirePermission(Permissions.STUDENT_GROUP)
  updateGroup(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.service.updateGroup(id, data);
  }

  @Delete('groups/:id')
  @RequirePermission(Permissions.STUDENT_GROUP)
  deleteGroup(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteGroup(id);
  }

  // ═══ 学员 CRUD ═══

  @Get()
  @RequirePermission(Permissions.STUDENT_CREATE)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('feeStatus') feeStatus?: string,
    @Query('allRoles') allRoles?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      keyword, source, feeStatus,
      groupId: groupId ? parseInt(groupId) : undefined,
      status,
      allRoles: allRoles === 'true',
    });
  }

  // ═══ 学员详情 ═══

  @Get(':id/profile')
  @RequirePermission(Permissions.STUDENT_CREATE)
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProfile(id);
  }

  @Get(':id/exam-history')
  @RequirePermission(Permissions.STUDENT_CREATE)
  getExamHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getExamHistory(id, page ? parseInt(page) : undefined, pageSize ? parseInt(pageSize) : undefined);
  }

  @Get(':id/certificates')
  @RequirePermission(Permissions.STUDENT_CREATE)
  getCertificates(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCertificates(id);
  }

  @Get(':id/fee-records')
  @RequirePermission(Permissions.STUDENT_CREATE)
  getFeeRecords(@Param('id', ParseIntPipe) id: number) {
    return this.service.getFeeRecords(id);
  }

  @Post(':id/fee-records')
  @RequirePermission(Permissions.STUDENT_EDIT)
  addFeeRecord(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { examId?: number; type: string; amount: number; status: string; paidAt?: string; method?: string; invoiceNo?: string; note?: string },
  ) {
    return this.service.addFeeRecord({ ...data, studentId: id });
  }

  @Put(':id/fee-status')
  @RequirePermission(Permissions.STUDENT_EDIT)
  updateFeeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { feeStatus: string },
  ) {
    return this.service.updateFeeStatus(id, data.feeStatus);
  }

  @Post(':id/reset-password')
  @RequirePermission(Permissions.STUDENT_EDIT)
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetPassword(id);
  }

  @Get(':id')
  @RequirePermission(Permissions.STUDENT_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission(Permissions.STUDENT_CREATE)
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermission(Permissions.STUDENT_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.service.update(id, data);
  }
}
