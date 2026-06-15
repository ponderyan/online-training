import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { StudentsService } from './students.service.js';

@Controller('api/students')
export class StudentsController {
  constructor(private service: StudentsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      keyword,
      groupId: groupId ? parseInt(groupId) : undefined,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() data: {
    username: string; displayName: string; password?: string;
    studentNumber?: string; phone?: string; email?: string;
    organization?: string; groupId?: number;
  }) {
    return this.service.create(data);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: {
    displayName?: string; studentNumber?: string; phone?: string;
    email?: string; organization?: string; groupId?: number | null;
    isActive?: boolean; password?: string;
  }) {
    return this.service.update(id, data);
  }

  @Post('batch')
  batchCreate(@Body() data: { students: {
    username: string; displayName: string; password?: string;
    studentNumber?: string; phone?: string; email?: string;
    organization?: string; groupId?: number;
  }[] }) {
    return this.service.batchCreate(data.students);
  }

  // ── 分组管理 ──

  @Get('groups/all')
  findAllGroups() {
    return this.service.findAllGroups();
  }

  @Post('groups')
  createGroup(@Body() data: { name: string; note?: string }) {
    return this.service.createGroup(data);
  }

  @Put('groups/:id')
  updateGroup(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; note?: string; isActive?: boolean }) {
    return this.service.updateGroup(id, data);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteGroup(id);
  }
}
