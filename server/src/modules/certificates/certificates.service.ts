import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class CertificatesService {
  private certDir = path.resolve('uploads/certificates');

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
  ) {
    fs.mkdir(this.certDir, { recursive: true }).catch(() => {});
  }

  /**
   * 生成证书编号
   * 格式（带培训班）：FX-{programCode}-{YYMMDD}-{4位流水号}
   * 格式（无培训班）：FX-{YYYYMMDD}-{4位流水号}
   */
  private async generateCertificateNo(examSessionId?: number): Promise<string> {
    const date = new Date();
    let prefix: string;

    if (examSessionId) {
      // 尝试从 ExamSession → Exam → TrainingProgram 获取 code
      const session = await this.prisma.examSession.findUnique({
        where: { id: examSessionId },
        include: { exam: { include: { program: { select: { code: true } } } } },
      });
      const programCode = session?.exam?.program?.code;
      if (programCode) {
        const shortDate = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        prefix = `FX-${programCode}-${shortDate}-`;
      } else {
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        prefix = `FX-${dateStr}-`;
      }
    } else {
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      prefix = `FX-${dateStr}-`;
    }

    // 查询当天已发的最大流水号（同前缀）
    const lastCert = await this.prisma.certificate.findFirst({
      where: { certificateNo: { startsWith: prefix } },
      orderBy: { certificateNo: 'desc' },
      select: { certificateNo: true },
    });

    let seq = 1;
    if (lastCert) {
      const lastSeq = parseInt(lastCert.certificateNo.slice(-4), 10);
      seq = (lastSeq || 0) + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /** 批量发证 */
  async issueCertificates(examSessionId: number, studentIds: number[]) {
    // 获取考试信息
    const session = await this.prisma.examSession.findUnique({
      where: { id: examSessionId },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.scoringStatus !== 'PUBLISHED') {
      throw new BadRequestException('成绩尚未发布，无法发证');
    }

    const exam = await this.prisma.exam.findUnique({ where: { id: session.examId } });
    if (!exam) throw new NotFoundException('考试不存在');

    const results: any[] = [];

    for (const studentId of studentIds) {
      // 检查是否已有证书（防止重复发证）
      const existing = await this.prisma.certificate.findFirst({
        where: { examSessionId, studentId, isRevoked: false },
      });
      if (existing) {
        results.push({ studentId, error: '已有有效证书', certificate: existing });
        continue;
      }

      // 获取学员信息
      const user = await this.prisma.user.findUnique({ where: { id: studentId } });
      if (!user) {
        results.push({ studentId, error: '学员不存在' });
        continue;
      }

      const certNo = await this.generateCertificateNo(examSessionId);
      const verificationCode = crypto.randomBytes(16).toString('hex');

      const certificate = await this.prisma.certificate.create({
        data: {
          examSessionId,
          studentId,
          certificateNo: certNo,
          studentName: user.displayName || user.username,
          courseName: exam.title,
          verificationCode,
        },
      });

      // 创建证书签发追溯记录
      await this.prisma.certificateTrace.create({
        data: {
          certificateId: certificate.id,
          traceType: 'ISSUE',
          snapshotData: certificate as any,
          operatorId: 0,
          reason: '自动签发',
        },
      }).catch(() => {});

      // ← 通知学员证书已生成
      void this.notificationService.create(
        studentId,
        'CERT_ISSUED' as any,
        `证书已生成`,
        `你的【${exam.title || ''}】证书已生成，编号：${certNo}`,
        certificate.id, 'certificate',
      );

      results.push({ studentId, certificate });
    }

    return results;
  }

  /** 单个补发证书 */
  async issueSingleCertificate(examSessionId: number, studentId: number) {
    const results = await this.issueCertificates(examSessionId, [studentId]);
    const item = results[0];
    if (item.error) throw new BadRequestException(item.error);
    return item.certificate;
  }

  /** 公开查询证书 */
  async verifyCertificate(certificateNo: string, verificationCode: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNo },
    });
    if (!cert) return { valid: false, message: '证书不存在' };
    if (cert.verificationCode !== verificationCode) return { valid: false, message: '验证码错误' };

    // 记录查询日志
    await this.prisma.certificateVerificationLog.create({
      data: {
        certificateId: cert.id,
        queryType: 'PUBLIC',
      },
    }).catch(() => {});

    return {
      valid: !cert.isRevoked,
      certificate: {
        studentName: cert.studentName,
        courseName: cert.courseName,
        issueDate: cert.issueDate,
        certificateNo: cert.certificateNo,
        isRevoked: cert.isRevoked,
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason,
        verificationUrl: `https:foxlearn.cn/certificates/verify?no=${cert.certificateNo}&code=${cert.verificationCode}`,
      },
    };
  }

  /** 撤销证书 */
  async revokeCertificate(id: number, reason: string, operatorId?: number) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('证书不存在');
    if (cert.isRevoked) throw new BadRequestException('证书已被撤销');

    const result = await this.prisma.certificate.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date(), revokeReason: reason },
    });

    await this.prisma.certificateTrace.create({
      data: { certificateId: id, traceType: 'REVOKE', snapshotData: cert as any, operatorId: operatorId || 1, reason },
    }).catch(() => {});

    return result;
  }

  /** 证书追溯链 */
  async getTraces(id: number) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('证书不存在');
    return this.prisma.certificateTrace.findMany({
      where: { certificateId: id },
      include: { operator: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 证书列表（后台） */
  async listCertificates(params: {
    examSessionId?: number;
    studentId?: number;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (params.examSessionId) where.examSessionId = params.examSessionId;
    if (params.studentId) where.studentId = params.studentId;

    const [items, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.certificate.count({ where }),
    ]);

    return { items, total, page: params.page, totalPages: Math.ceil(total / params.limit) };
  }

  /** 获取学员的证书列表 */
  async getStudentCertificates(studentId: number) {
    return this.prisma.certificate.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 生成证书 PDF */
  async generatePdf(id: number): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('证书不存在');

    // 动态导入 puppeteer
    const puppeteer = await import('puppeteer');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; }
  body {
    margin: 0;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f5f0eb;
  }
  .certificate {
    width: 800px;
    height: 560px;
    background: #fff;
    border: 2px solid #d4a574;
    padding: 48px 56px;
    box-sizing: border-box;
    position: relative;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
  .certificate::before {
    content: '';
    position: absolute;
    top: 12px; left: 12px; right: 12px; bottom: 12px;
    border: 1px solid #e8d5c0;
    pointer-events: none;
  }
  .header {
    text-align: center;
    margin-bottom: 36px;
  }
  .logo {
    font-size: 18px;
    color: #e87a30;
    letter-spacing: 4px;
    margin-bottom: 8px;
  }
  .title {
    font-size: 32px;
    font-weight: bold;
    color: #3a3028;
    letter-spacing: 12px;
  }
  .body-text {
    text-align: center;
    font-size: 15px;
    color: #5a5048;
    line-height: 2.2;
    margin: 36px 0;
  }
  .name {
    font-size: 28px;
    font-weight: bold;
    color: #3a3028;
    letter-spacing: 4px;
  }
  .course {
    font-size: 16px;
    color: #e87a30;
    font-weight: 600;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #8a8078;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px dashed #d4a574;
  }
  .verify {
    font-size: 12px;
    color: #a09890;
    text-align: center;
    margin-top: 8px;
  }
</style>
</head>
<body>
<div class="certificate">
  <div class="header">
    <div class="logo">🦊 FoxLearn</div>
    <div class="title">证 书</div>
  </div>
  <div class="body-text">
    兹证明<br>
    <span class="name">${cert.studentName}</span><br>
    参加 <span class="course">${cert.courseName}</span><br>
    成绩合格，特发此证
  </div>
  <div class="meta">
    <span>证书编号：${cert.certificateNo}</span>
    <span>发证日期：${cert.issueDate.toISOString().slice(0, 10)}</span>
  </div>
  <div class="verify">
    验证码：${cert.verificationCode.slice(0, 8).toUpperCase()} | foxlearn.cn/verify
  </div>
</div>
</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /** 保存 PDF 到磁盘并返回路径 */
  async savePdf(id: number): Promise<string> {
    const pdf = await this.generatePdf(id);
    const fileName = `certificate-${id}.pdf`;
    const filePath = path.join(this.certDir, fileName);
    await fs.writeFile(filePath, pdf);
    return filePath;
  }

  // ═══ 证书申请审批 ═══

  async listApplications(params: { status?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const [items, total] = await Promise.all([
      this.prisma.certificateApplication.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.certificateApplication.count({ where }),
    ]);
    // Attach student/exam info
    const userIds = items.map(i => i.studentId);
    const users = userIds.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true, organization: true } }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));
    // Get session->exam mapping
    const sessionIds = items.map(i => i.sessionId);
    const sessions = sessionIds.length > 0 ? await this.prisma.examSession.findMany({ where: { id: { in: sessionIds } }, include: { exam: { select: { id: true, title: true } } } }) : [];
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    return { items: items.map(i => ({ ...i, student: userMap.get(i.studentId) || null, examSession: sessionMap.get(i.sessionId) || null })), total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async approveApplication(id: number, operatorId: number) {
    const app = await this.prisma.certificateApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') throw new BadRequestException('只有待审批的申请可以操作');
    // Auto-generate certificate
    try { await this.issueSingleCertificate(app.sessionId, app.studentId); } catch {}
    const result = await this.prisma.certificateApplication.update({ where: { id }, data: { status: 'APPROVED' } });
    // ← 审批日志
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId }, select: { displayName: true } });
    await this.prisma.certificateApprovalLog.create({
      data: { certificateId: app.id || 0, action: 'APPROVED', operatorId, operatorName: operator?.displayName || '系统', note: null },
    }).catch(() => {});
    // ← 通知学员
    void this.notificationService.create(
      app.studentId,
      'CERT_APPROVED' as any,
      `证书审批通过`,
      `你的证书申请已通过`,
      app.id, 'certificate',
    );
    return result;
  }

  async batchApproveApplications(ids: number[], operatorId: number) {
    const results: any[] = [];
    for (const id of ids) {
      try { await this.approveApplication(id, operatorId); results.push({ id, status: 'approved' }); }
      catch (e: any) { results.push({ id, status: 'failed', error: e.message }); }
    }
    return { results };
  }

  async rejectApplication(id: number, reason: string, operatorId: number) {
    const app = await this.prisma.certificateApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') throw new BadRequestException('只有待审批的申请可以操作');
    const result = await this.prisma.certificateApplication.update({ where: { id }, data: { status: 'REJECTED' } });
    // ← 审批日志
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId }, select: { displayName: true } });
    await this.prisma.certificateApprovalLog.create({
      data: { certificateId: app.id || 0, action: 'REJECTED', operatorId, operatorName: operator?.displayName || '系统', note: reason || null },
    }).catch(() => {});
    // ← 通知学员
    void this.notificationService.create(
      app.studentId,
      'CERT_REJECTED' as any,
      `证书申请未通过`,
      reason || '你的证书申请未通过',
      app.id, 'certificate',
    );
    return result;
  }
}
