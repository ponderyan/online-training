import { Controller, Get, Param, ParseIntPipe, Req, UnauthorizedException } from '@nestjs/common';
import { StudentScoresService } from './student-scores.service.js';

@Controller('api/student/scores')
export class StudentScoresController {
  constructor(private service: StudentScoresService) {}

  /** 学员查看自己的成绩变动记录（脱敏版，不展示操作人） */
  @Get(':examId/changes')
  async getChanges(@Param('examId', ParseIntPipe) examId: number, @Req() req: any) {
    const studentId = req.user?.sub || req.user?.id;
    if (!studentId) throw new UnauthorizedException('请先登录');
    return this.service.getScoreChanges(examId, studentId);
  }
}
