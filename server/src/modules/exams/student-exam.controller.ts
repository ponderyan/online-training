import { Controller, Get, Post, Param, Body, ParseIntPipe, Req, UnauthorizedException } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { ExamAnalysisService } from './exam-analysis.service.js';
import { LearningReportService } from './learning-report.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/student/exams')
export class StudentExamController {
  constructor(
    private service: ExamsService,
    private examAnalysisService: ExamAnalysisService,
    private learningReportService: LearningReportService,
  ) {}

  /** 从请求中提取学员ID（当前简化版：从 JWT payload 取） */
  private getStudentId(req: any): number {
    const user = req.user;
    if (!user) throw new UnauthorizedException('请先登录');
    return user.sub || user.id;
  }

  @Get('learning-report')
  async getLearningReport(@Req() req: any) {
    const studentId = req.user?.id || req.user?.sub;
    if (!studentId) throw new UnauthorizedException();
    return this.learningReportService.getReport(studentId);
  }

  @Get()
  @RequirePermission(Permissions.EXAM_VIEW)
  list(@Req() req: any) {
    return this.service.getStudentExams(this.getStudentId(req));
  }

  @Get(':id')
  @RequirePermission(Permissions.EXAM_VIEW)
  start(@Param('id') id: string, @Req() req: any) {
    return this.service.startExam(parseInt(id, 10), this.getStudentId(req));
  }

  @Post(':id/submit')
  @RequirePermission(Permissions.EXAM_VIEW)
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { answers: { questionId: number; paperQuestionId: number; answer: any }[]; tabSwitchLog?: any[] },
    @Req() req: any,
  ) {
    return this.service.submitExam(id, this.getStudentId(req), data.answers, data.tabSwitchLog);
  }

  @Post(':id/save-answer')
  @RequirePermission(Permissions.EXAM_VIEW)
  saveSingleAnswer(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { questionId: number; paperQuestionId: number; answer: any },
    @Req() req: any,
  ) {
    return this.service.saveSingleAnswer(id, this.getStudentId(req), data);
  }

  @Post(':id/heartbeat')
  @RequirePermission(Permissions.EXAM_VIEW)
  heartbeat(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { tabSwitchData?: any[] },
    @Req() req: any,
  ) {
    return this.service.heartbeat(id, this.getStudentId(req), data?.tabSwitchData);
  }

  @Post(':id/mark')
  @RequirePermission(Permissions.EXAM_VIEW)
  markQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { questionId: number },
    @Req() req: any,
  ) {
    return this.service.markQuestion(id, this.getStudentId(req), data.questionId);
  }

  @Post(':id/unmark')
  @RequirePermission(Permissions.EXAM_VIEW)
  unmarkQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { questionId: number },
    @Req() req: any,
  ) {
    return this.service.unmarkQuestion(id, this.getStudentId(req), data.questionId);
  }

  @Get(':id/result')
  result(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.getResult(id, this.getStudentId(req));
  }

  @Post(':id/messages/:messageId/read')
  @RequirePermission(Permissions.EXAM_VIEW)
  async readMessage(
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Req() req: any,
  ) {
    const studentId = this.getStudentId(req);
    return this.service.markMessageRead(id, studentId, messageId);
  }

  @Get(':examId/knowledge-analysis')
  async getKnowledgeAnalysis(
    @Param('examId', ParseIntPipe) examId: number,
    @Req() req: any,
  ) {
    const studentId = req.user?.id;
    if (!studentId) throw new UnauthorizedException();
    return this.examAnalysisService.getKnowledgeAnalysis(examId, studentId);
  }

}
