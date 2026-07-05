import { Controller, Get, Post, Param, Body, Query, ParseIntPipe, Res, Req, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { CertificatesService } from './certificates.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/certificates')
export class CertificatesController {
  constructor(private service: CertificatesService) {}

  // ═══════════════════════════════════════════════════════
  // 命名路由（具体路径优先，避免被参数化路由截获）
  // ═══════════════════════════════════════════════════════

  /** 证书申请列表 */
  @Get('applications')
  @RequirePermission(Permissions.CERT_ISSUE)
  async listApplications(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listApplications({ status, page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20 });
  }

  /** 批量审批申请 */
  @Post('applications/batch-approve')
  @RequirePermission(Permissions.CERT_ISSUE)
  async batchApproveApplications(@Body() data: { ids: number[]; operatorId: number }) {
    return this.service.batchApproveApplications(data.ids, data.operatorId);
  }

  /** 审批单个申请 */
  @Post('applications/:id/approve')
  @RequirePermission(Permissions.CERT_ISSUE)
  async approveApplication(@Param('id', ParseIntPipe) id: number, @Body() data: { operatorId: number }) {
    return this.service.approveApplication(id, data.operatorId);
  }

  /** 驳回申请 */
  @Post('applications/:id/reject')
  @RequirePermission(Permissions.CERT_ISSUE)
  async rejectApplication(@Param('id', ParseIntPipe) id: number, @Body() data: { reason: string; operatorId: number }) {
    return this.service.rejectApplication(id, data.reason, data.operatorId);
  }

  /** 获取自己的证书（学员端） */
  @Get('my')
  async myCertificates(@Req() req: any) {
    const studentId = req.user?.sub || req.user?.id;
    if (!studentId) throw new UnauthorizedException('请先登录');
    return this.service.getStudentCertificates(studentId);
  }

  /** 公开查询（无需认证） */
  @Public()
  @Get('verify')
  async verify(
    @Query('no') certificateNo: string,
    @Query('code') verificationCode: string,
    @Query('sig') signature?: string,
  ) {
    const result = await this.service.verifyCertificate(certificateNo, verificationCode);
    // 如果有 sig 参数，执行 HMAC 验签
    if (signature && result.valid) {
      const { verifyCertificateQrData } = await import('./cert-verify-utils.js');
      (result as any).signatureValid = verifyCertificateQrData(certificateNo, verificationCode, signature);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  // 参数化路由（放在具体的命名路由之后）
  // ═══════════════════════════════════════════════════════

  /** 批量发证 */
  @Post()
  @RequirePermission(Permissions.CERT_ISSUE)
  async issue(@Body() data: { examSessionId: number; studentIds: number[] }) {
    return this.service.issueCertificates(data.examSessionId, data.studentIds);
  }

  /** 证书列表（后台） */
  @Get()
  @RequirePermission(Permissions.CERT_VIEW)
  async list(
    @Query('examSessionId') examSessionId?: string,
    @Query('studentId') studentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listCertificates({
      examSessionId: examSessionId ? parseInt(examSessionId) : undefined,
      studentId: studentId ? parseInt(studentId) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /** 单个发证/补发 */
  @Post(':examSessionId/:studentId')
  @RequirePermission(Permissions.CERT_ISSUE)
  async issueSingle(
    @Param('examSessionId', ParseIntPipe) examSessionId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.service.issueSingleCertificate(examSessionId, studentId);
  }

  /** 撤销证书 */
  @Post(':id/revoke')
  @RequirePermission(Permissions.CERT_REVOKE)
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { reason: string; operatorId?: number },
  ) {
    return this.service.revokeCertificate(id, data.reason, data.operatorId);
  }

  /** 证书追溯链 */
  @Get(':id/traces')
  @RequirePermission(Permissions.CERT_VIEW)
  async getTraces(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTraces(id);
  }

  /** 下载证书 PDF */
  @Get(':id/pdf')
  @RequirePermission(Permissions.CERT_VIEW)
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdf = await this.service.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
