import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ExamsService } from './exams.service.js';

@Controller('api/student')
export class StudentLearningController {
  constructor(private service: ExamsService) {}

  /** 从 JWT 提取学员 ID */
  private getStudentId(req: any): number {
    const user = req.user;
    if (!user) throw new UnauthorizedException('请先登录');
    return user.sub || user.id;
  }

  @Get('my-learning')
  async getMyLearning(@Req() req: any) {
    const studentId = this.getStudentId(req);
    return this.service.getMyLearning(studentId);
  }
}
