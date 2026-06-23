import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { EnrollmentAgenciesService } from './enrollment-agencies.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/enrollment-agencies')
export class EnrollmentAgenciesController {
  constructor(private service: EnrollmentAgenciesService) {}
  @Get() @RequirePermission(P.AGENCY_VIEW) findAll(@Query('page') page?: string, @Query('keyword') keyword?: string) { return this.service.findAll({ page: page ? parseInt(page) : undefined, keyword }); }
  @Get(':id') @RequirePermission(P.AGENCY_VIEW) findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @RequirePermission(P.AGENCY_CREATE) create(@Body() data: any) { return this.service.create(data); }
  @Put(':id') @RequirePermission(P.AGENCY_EDIT) update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }
  @Delete(':id') @RequirePermission(P.AGENCY_DELETE) delete(@Param('id', ParseIntPipe) id: number) { return this.service.delete(id); }
}
