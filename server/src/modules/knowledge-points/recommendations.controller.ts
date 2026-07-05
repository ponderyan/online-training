import { Controller, Get, Post, Param, Body, Req, ParseIntPipe } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * 关联课程到考点
   * KNOWLEDGE_MANAGE 权限
   */
  @Post('knowledge-points/:kpId/courses')
  @RequirePermission(P.KNOWLEDGE_MANAGE)
  setKpCourses(
    @Param('kpId', ParseIntPipe) kpId: number,
    @Body() body: { courseIds: number[] },
  ) {
    return this.recommendationsService.setKpCourses(kpId, body.courseIds);
  }

  /**
   * 获取某考点的课程
   * KNOWLEDGE_VIEW 权限
   */
  @Get('knowledge-points/:kpId/courses')
  @RequirePermission(P.KNOWLEDGE_VIEW)
  getKpCourses(@Param('kpId', ParseIntPipe) kpId: number) {
    return this.recommendationsService.getKpCourses(kpId);
  }

  /**
   * 学员个性化推荐
   * 学员端接口，无需额外权限标记（全局守卫要求已登录即可）
   */
  @Get('student/recommendations')
  getRecommendations(@Req() req: any) {
    const studentId = req.user?.id || req.user?.sub;
    return this.recommendationsService.getRecommendations(studentId);
  }
}
