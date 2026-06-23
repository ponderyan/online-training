import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ExamAnalysisService } from './exam-analysis.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class ExamAnalysisController {
  constructor(private service: ExamAnalysisService) {}

  @Get(':id/analysis/overview')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getOverview(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOverview(id);
  }

  @Get(':id/analysis/distribution')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getDistribution(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDistribution(id);
  }

  @Get(':id/analysis/question-accuracy')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getQuestionAccuracy(@Param('id', ParseIntPipe) id: number) {
    return this.service.getQuestionAccuracy(id);
  }
}
