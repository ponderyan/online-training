import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/learning-hour-types')
export class LearningHourTypesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequirePermission(P.LEARNING_HOUR_VIEW)
  async findAll() {
    return this.prisma.learningHourType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('all')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async findAllAdmin() {
    return this.prisma.learningHourType.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post()
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async create(@Body() data: { name: string; code: string; description?: string; sortOrder?: number }) {
    return this.prisma.learningHourType.create({ data });
  }

  @Patch(':id')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; code?: string; description?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.learningHourType.update({ where: { id }, data });
  }

  @Delete(':id')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async delete(@Param('id', ParseIntPipe) id: number) {
    // 软删
    return this.prisma.learningHourType.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
