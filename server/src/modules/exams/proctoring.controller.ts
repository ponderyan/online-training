import { Controller, Get, Put, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ProctoringService } from './proctoring.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';
import { requestContext } from '../../common/utils/request-context.js';

@Controller('api/exams/:examId/proctoring')
export class ProctoringController {
  constructor(private service: ProctoringService) {}

  @Get('overview')
  @RequirePermission(Permissions.PROCTOR_VIEW)
  async getOverview(@Param('examId', ParseIntPipe) examId: number) {
    return this.service.getOverview(examId);
  }

  @Get('sessions')
  @RequirePermission(Permissions.PROCTOR_VIEW)
  async getSessions(
    @Param('examId', ParseIntPipe) examId: number,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getSessions(examId, {
      status, keyword,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
    });
  }

  @Get('sessions/:sessionId')
  @RequirePermission(Permissions.PROCTOR_VIEW)
  async getSessionDetail(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.service.getSessionDetail(examId, sessionId);
  }

  @Put('sessions/:sessionId/warn')
  @RequirePermission(Permissions.PROCTOR_FORCE_SUBMIT)
  async warn(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() data: { message: string; operatorName: string },
  ) {
    return this.service.warn(examId, sessionId, data.message, data.operatorName);
  }

  @Get('sessions/:sessionId/messages')
  @RequirePermission(Permissions.PROCTOR_VIEW)
  getMessages(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.service.getMessages(examId, sessionId);
  }

  @Put('sessions/:sessionId/force-submit')
  @RequirePermission(Permissions.PROCTOR_FORCE_SUBMIT)
  async forceSubmit(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() data: { reason: string; operatorName: string },
  ) {
    const store = requestContext.getStore();
    if (store) requestContext.enterWith({ ...store, changeReason: data.reason });
    return this.service.forceSubmit(examId, sessionId, data.reason, data.operatorName);
  }

  @Put('sessions/:sessionId/extend-time')
  @RequirePermission(Permissions.PROCTOR_EXTEND_TIME)
  async extendTime(
    @Param('examId', ParseIntPipe) examId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() data: { extraSeconds: number; reason: string; operatorName: string },
  ) {
    const store = requestContext.getStore();
    if (store) requestContext.enterWith({ ...store, changeReason: data.reason });
    return this.service.extendTime(examId, sessionId, data.extraSeconds, data.reason, data.operatorName);
  }
}
