import { Controller, Get, Post, Patch, Param, Body, Query, ParseIntPipe, Res, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { LearningHourCertificatesService } from './learning-hour-certificates.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/learning-hour-certificates')
export class LearningHourCertificatesController {
  constructor(private service: LearningHourCertificatesService) {}

  // ═══════════════════════════════════════════════════════
  // 命名路由（具体路径优先，避免被参数化路由截获）
  // ═══════════════════════════════════════════════════════

  /** 申请学时证明（学员自服务） */
  @Post('apply')
  async apply(@Body() body: { programId: number }, @Req() req: any) {
    const studentId = req.user?.sub || req.user?.id;
    if (!studentId) throw new UnauthorizedException('请先登录');
    return this.service.apply(studentId, body.programId);
  }

  /** 预览学时聚合（不创建证明） */
  @Get('preview')
  async preview(@Query('programId') programId: string, @Req() req: any) {
    const studentId = req.user?.sub || req.user?.id;
    if (!studentId) throw new UnauthorizedException('请先登录');
    if (!programId) throw new BadRequestException('缺少 programId');
    return this.service.preview(studentId, parseInt(programId));
  }

  /** 获取自己的学时证明列表（学员端） */
  @Get('my')
  async myCertificates(@Req() req: any) {
    const studentId = req.user?.sub || req.user?.id;
    if (!studentId) throw new UnauthorizedException('请先登录');
    return this.service.findMy(studentId);
  }

  /** 公开查询（无需认证）- 通过 certificateNo 验证 */
  @Public()
  @Get('verify')
  async verify(@Query('no') certificateNo: string) {
    if (!certificateNo) throw new BadRequestException('缺少证书编号参数 no');
    return this.service.verify(certificateNo);
  }

  /** 学时证明列表（后台管理） */
  @Get()
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async list(
    @Query('studentId') studentId?: string,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      studentId: studentId ? parseInt(studentId) : undefined,
      programId: programId ? parseInt(programId) : undefined,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ═══════════════════════════════════════════════════════
  // 参数化路由（放在命名路由之后）
  // ═══════════════════════════════════════════════════════

  /** 下载学时证明 PDF */
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdf = await this.service.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="learning-hour-certificate-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  /** 审核学时证明 */
  @Patch(':id/review')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'approve' | 'reject'; note?: string },
    @Req() req: any,
  ) {
    const reviewerId = req.user?.id || req.user?.sub;
    if (!reviewerId) throw new UnauthorizedException('请先登录');
    return this.service.review(id, body.action, reviewerId, body.note);
  }

  /** 吊销学时证明 */
  @Patch(':id/revoke')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    const reviewerId = req.user?.id || req.user?.sub;
    if (!reviewerId) throw new UnauthorizedException('请先登录');
    if (!body.reason) throw new BadRequestException('吊销原因不能为空');
    return this.service.revoke(id, body.reason, reviewerId);
  }

  /** 获取单个学时证明详情 */
  @Get(':id')
  @RequirePermission(P.LEARNING_HOUR_MANAGE)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
