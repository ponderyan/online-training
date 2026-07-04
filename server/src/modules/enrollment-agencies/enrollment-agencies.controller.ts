import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, Req, ForbiddenException } from '@nestjs/common';
import { EnrollmentAgenciesService } from './enrollment-agencies.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/enrollment-agencies')
export class EnrollmentAgenciesController {
  constructor(private service: EnrollmentAgenciesService) {}

  // ── 雷达图必须在 :id 之前注册，避免路由冲突 ──

  @Get('radar') @RequirePermission(P.AGENCY_VIEW)
  async getRadar(
    @Req() req: any,
    @Query('agencyId') agencyId?: string,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
    @Query('monthStart') monthStart?: string,
    @Query('monthEnd') monthEnd?: string,
  ) {
    const params: any = {};
    if (req.user?.roles?.includes('AGENCY_ADMIN') && req.user?.primaryAgencyId) {
      params.agencyId = req.user.primaryAgencyId;
    } else if (agencyId) {
      params.agencyId = parseInt(agencyId);
    }
    if (year) params.year = parseInt(year);
    if (quarter) params.quarter = parseInt(quarter);
    if (monthStart) params.monthStart = monthStart;
    if (monthEnd) params.monthEnd = monthEnd;
    return this.service.getRadar(params);
  }

  @Get() @RequirePermission(P.AGENCY_VIEW)
  async findAll(@Req() req: any, @Query('page') page?: string, @Query('keyword') keyword?: string) {
    return this.service.findAll(req.user, { page: page ? parseInt(page) : undefined, keyword });
  }

  @Get(':id') @RequirePermission(P.AGENCY_VIEW)
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权查看其他机构数据');
    }
    return this.service.findOne(id);
  }

  @Post() @RequirePermission(P.AGENCY_CREATE) create(@Body() data: any) { return this.service.create(data); }
  @Put(':id') @RequirePermission(P.AGENCY_EDIT) update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }
  @Delete(':id') @RequirePermission(P.AGENCY_DELETE) delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }

  @Get(':id/students') @RequirePermission(P.AGENCY_VIEW_STUDENTS)
  async findStudents(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('page') page?: string, @Query('keyword') keyword?: string) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权查看其他机构学员');
    }
    return this.service.findStudents(id, { page: page ? parseInt(page) : undefined, keyword });
  }

  @Get(':id/students/progress') @RequirePermission(P.AGENCY_VIEW_STUDENTS)
  async findStudentProgress(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('studentId') studentId?: string) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权查看其他机构数据');
    }
    return this.service.findStudentProgress(id, studentId ? parseInt(studentId) : undefined);
  }

  @Get(':id/enrollments') @RequirePermission(P.AGENCY_VIEW_STUDENTS)
  async findEnrollments(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('studentId') studentId?: string) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权查看其他机构数据');
    }
    return this.service.findEnrollments(id, studentId ? parseInt(studentId) : undefined);
  }

  // ═══════════════════════════════════
  // 机构成员管理
  // ═══════════════════════════════════

  @Get(':id/members') @RequirePermission(P.AGENCY_MANAGE_STUDENTS)
  async findMembers(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权查看其他机构成员');
    }
    return this.service.findMembers(id);
  }

  @Post(':id/members') @RequirePermission(P.AGENCY_MANAGE_STUDENTS)
  async createMember(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() data: { displayName: string; username: string; phone?: string; roleCode: string }) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权操作其他机构');
    }
    return this.service.createMember(id, data);
  }

  @Put(':id/members/:userId') @RequirePermission(P.AGENCY_MANAGE_STUDENTS)
  async updateMemberRole(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number, @Body() data: { roleCode: string }) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权操作其他机构');
    }
    return this.service.updateMemberRole(id, userId, data.roleCode);
  }

  @Delete(':id/members/:userId') @RequirePermission(P.AGENCY_MANAGE_STUDENTS)
  async removeMember(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) {
    if (req.user?.roles?.includes('AGENCY_ADMIN') && id !== req.user?.primaryAgencyId) {
      throw new ForbiddenException('无权操作其他机构');
    }
    return this.service.removeMember(id, userId);
  }
}
