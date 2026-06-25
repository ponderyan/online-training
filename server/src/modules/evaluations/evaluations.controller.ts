import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/evaluations')
export class EvaluationsController {
  constructor(private service: EvaluationsService) {}

  /** 学员提交评价 */
  @Post()
  async create(@Body() data: {
    studentId: number; programId: number;
    contentRating: number; instructorRating: number; organizationRating?: number;
    overallRating: number; comment?: string; isAnonymous?: boolean;
    instructorId?: number; courseId?: number;
  }) {
    return this.service.create(data.studentId, data);
  }

  /** 管理员：某培训班的所有评价 */
  @Get('program/:programId')
  @RequirePermission(Permissions.EVALUATION_VIEW)
  async findByProgram(@Param('programId', ParseIntPipe) programId: number) {
    return this.service.findByProgram(programId);
  }

  /** 删除评价 */
  @Delete(':id')
  @RequirePermission(Permissions.EVALUATION_MANAGE)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  /** 某培训班的评价统计 */
  @Get('program/:programId/stats')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getProgramStats(@Param('programId', ParseIntPipe) programId: number) {
    return this.service.getProgramStats(programId);
  }

  /** 学员：我的评价 */
  @Get('my')
  async findMy(@Query('studentId', ParseIntPipe) studentId: number) {
    return this.service.findMy(studentId);
  }

  /** 讲师的评价汇总 */
  @Get('instructor/:instructorId')
  async getInstructorStats(@Param('instructorId', ParseIntPipe) instructorId: number) {
    return this.service.getInstructorStats(instructorId);
  }
}
