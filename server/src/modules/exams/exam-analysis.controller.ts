import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
import { ExamAnalysisService } from './exam-analysis.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class ExamAnalysisController {
  constructor(private service: ExamAnalysisService) {}

  // ═══════════════════════════════
  //   质检报告
  // ═══════════════════════════════

  @Get(':id/quality-report')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getQualityReport(@Param('id', ParseIntPipe) id: number) {
    return this.service.getQualityReport(id);
  }

  @Get(':id/quality-report/question/:questionId')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getQuestionDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.service.getQuestionDetail(id, questionId);
  }

  // ═══════════════════════════════
  //   原有分析接口
  // ═══════════════════════════════

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

  // ═══════════════════════════════
  //   学员知识点分析
  // ═══════════════════════════════

  @Get(':id/knowledge-analysis')
  @RequirePermission(Permissions.REPORT_VIEW)
  async getKnowledgeAnalysis(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const studentId = req.user?.sub || req.user?.id;
    return this.service.getKnowledgeAnalysis(id, studentId);
  }
}
