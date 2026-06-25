import { Controller, Get, Put, Param, Body, ParseIntPipe, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @RequirePermission(P.STUDENT_CREATE)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      keyword, role,
    });
  }

  @Get(':id')
  @RequirePermission(P.STUDENT_CREATE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @RequirePermission(P.STUDENT_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.service.update(id, data);
  }
}
