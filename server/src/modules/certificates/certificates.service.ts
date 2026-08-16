import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CertificateTemplatesService } from '../certificate-templates/certificate-templates.service.js';
import { renderCanvasToDocument } from '../certificate-templates/renderer/canvas-renderer.js';
import type { CanvasDef, TemplateData } from '../certificate-templates/renderer/canvas-types.js';
import { ResourceAccessService } from '../../common/services/resource-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class CertificatesService {
  private certDir = path.resolve('uploads/certificates');

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
    private systemConfig: SystemConfigService,
    private resourceAccess: ResourceAccessService,
    private certTemplatesService: CertificateTemplatesService,
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
  async issueCertificates(examSessionId: number, studentIds: number[], caller?: { userOrgId?: number | null; userRoles?: string[] }) {
    // ★ 证书策略检查
    const isSuperAdmin = caller?.userRoles?.includes('SUPER_ADMIN');
    if (!isSuperAdmin && caller?.userOrgId) {
      const orgSelfIssue = await this.systemConfig.getBoolean('cert_org_self_issue');
      if (!orgSelfIssue) {
        throw new ForbiddenException('当前系统不允许机构自行发证，请联系协会管理员');
      }
    }
    const approvalRequired = await this.systemConfig.getBoolean('cert_approval_required');

    // 获取考试信息
    const session = await this.prisma.examSession.findUnique({
      where: { id: examSessionId },
    });
    if (!session) throw new NotFoundException('考试记录不存在');
    if (session.scoringStatus !== 'PUBLISHED' && session.scoringStatus !== 'CONFIRMED') {
      throw new BadRequestException('成绩尚未发布，无法发证');
    }
    // ★ 校验学员是否通过考试，未通过不得发证
    if (session.isPassed !== true) {
      throw new BadRequestException('学员未通过该考试，无法发证');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: session.examId },
      include: { program: { select: { orgId: true } }, org: { select: { id: true, certIssuerName: true, name: true } } },
    });
    if (!exam) throw new NotFoundException('考试不存在');

    // 确定发证机构：优先 exam.orgId，其次 program.orgId
    const certOrgId = exam.orgId || exam.program?.orgId || null;
    let issuerName: string | null = null;
    if (exam.org?.certIssuerName) {
      issuerName = exam.org.certIssuerName;
    } else if (exam.org?.name) {
      issuerName = exam.org.name;
    }
    // 如果 exam 上没有 org 信息，通过 program.orgId 查
    if (!issuerName && certOrgId && !exam.orgId) {
      const progOrg = await this.prisma.organization.findUnique({
        where: { id: certOrgId },
        select: { certIssuerName: true, name: true },
      });
      issuerName = progOrg?.certIssuerName || progOrg?.name || null;
    }

    // 确定本次发证使用的模板（组织默认模板，与 PDF 渲染逻辑一致），用于"使用次数"统计
    // ★ 2026-08-13 修复断裂点 C：orgId ?? undefined 在无机构时会去掉过滤条件误命中他机构模板；
    //   改用 findDefaultTemplate（机构级 → 平台级 fallback）
    const issueTemplate = await this.certTemplatesService.findDefaultTemplate(certOrgId, 'COMPLETION');
    const issueTemplateId = issueTemplate?.id ?? null;

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
          orgId: certOrgId,
          issuerName,
          templateId: issueTemplateId,
          approvalStatus: approvalRequired ? 'PENDING' : 'APPROVED',
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
  async issueSingleCertificate(examSessionId: number, studentId: number, caller?: { userOrgId?: number | null; userRoles?: string[] }) {
    const results = await this.issueCertificates(examSessionId, [studentId], caller);
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

    // ★ 2026-08-16 审批门控（语义收紧）：仅 APPROVED 且未撤销才算有效。
    //   此前 `!isRevoked && approvalStatus !== 'PENDING'` 会把 REJECTED（审批拒绝）误判为有效，
    //   而驳回后证书 approvalStatus=REJECTED（2026-08-16 起）。PENDING 待审批 / REJECTED 已拒绝 / 已撤销均无效。
    const effective = cert.approvalStatus === 'APPROVED' && !cert.isRevoked;
    return {
      valid: effective,
      certificate: {
        studentName: cert.studentName,
        courseName: cert.courseName,
        issueDate: cert.issueDate,
        certificateNo: cert.certificateNo,
        isRevoked: cert.isRevoked,
        approvalStatus: cert.approvalStatus,
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason,
        verificationUrl: `${process.env.SITE_URL || 'https://foxlearn.cn'}/verify-certificate?no=${cert.certificateNo}&code=${cert.verificationCode}`,
      },
    };
  }

  /** 撤销证书（★ 2026-08-16：审批态门控 + 审批日志 + 学员通知，此前撤销静默无痕） */
  async revokeCertificate(id: number, reason: string, operatorId?: number) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('证书不存在');
    if (cert.isRevoked) throw new BadRequestException('证书已被撤销');
    // ★ 审批态门控：待审批/已驳回的证书不应「撤销」，应走审批驳回/无需操作
    if (cert.approvalStatus === 'PENDING') {
      throw new BadRequestException('证书待审批中，如需不通过请在「证书申请审批」页驳回');
    }
    if (cert.approvalStatus === 'REJECTED') {
      throw new BadRequestException('证书已被驳回，无需撤销');
    }

    const result = await this.prisma.certificate.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date(), revokeReason: reason },
    });

    await this.prisma.certificateTrace.create({
      data: { certificateId: id, traceType: 'REVOKE', snapshotData: cert as any, operatorId: operatorId || 1, reason },
    }).catch(() => {});

    // ← 审批日志留痕
    const operator = operatorId ? await this.prisma.user.findUnique({ where: { id: operatorId }, select: { displayName: true } }) : null;
    await this.prisma.certificateApprovalLog.create({
      data: { certificateId: id, action: 'REVOKED', operatorId: operatorId || 0, operatorName: operator?.displayName || '系统', note: reason || null },
    }).catch(() => {});
    // ← 通知学员
    void this.notificationService.create(
      cert.studentId,
      'CERT_REVOKED' as any,
      `证书已撤销`,
      `你的证书「${cert.courseName}」已撤销，如有疑问请联系管理员`,
      id, 'certificate',
    );

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
    status?: string;
    page: number;
    limit: number;
    userOrgId?: number | null;
    userRoles?: string[];
  }) {
    const where: any = {};
    if (params.examSessionId) where.examSessionId = params.examSessionId;
    // org filter for listCertificates
    const certRoles = params.userRoles ?? [];
    if (!certRoles.includes('SUPER_ADMIN') && (params.userOrgId ?? null) !== null) {
      const visIds = await this.resourceAccess.getVisibleOrgIds(params.userOrgId!);
      where.OR = [{ orgId: { in: visIds } }, { orgId: null }];
    }
    if (params.studentId) where.studentId = params.studentId;
    // ★ 2026-08-14 状态筛选（此前前端传 status 被忽略，筛选形同虚设）：
    //   ACTIVE=有效(已批准且未撤销)、PENDING=待审批、REJECTED=已拒绝、REVOKED=已撤销
    //   用 AND 包裹避免与上面的 org 过滤 OR 冲突
    if (params.status) {
      const st = params.status;
      if (st === 'ACTIVE') {
        where.AND = [{ isRevoked: false, approvalStatus: 'APPROVED' }];
      } else if (st === 'PENDING') {
        where.approvalStatus = 'PENDING';
      } else if (st === 'REJECTED') {
        where.approvalStatus = 'REJECTED';
      } else if (st === 'REVOKED') {
        where.isRevoked = true;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.certificate.count({ where }),
    ]);

    // ★ 2026-08-13 列表生成 QR data URL + 模板渲染预览 HTML（有 templateId 才渲染，控负载）
    const withQr = await Promise.all(items.map(async (cert) => {
      const qrDataUrl = await this.generateQrDataUrl(cert.certificateNo, cert.verificationCode);
      const previewHtml = cert.templateId ? await this.buildPreviewHtml(cert) : null;
      return { ...cert, qrDataUrl, previewHtml };
    }));

    return { items: withQr, total, page: params.page, totalPages: Math.ceil(total / params.limit) };
  }

  /** 获取学员的证书列表 */
  async getStudentCertificates(studentId: number) {
    const certs = await this.prisma.certificate.findMany({
      // ★ 2026-08-14 学员端只显示已生效证书（APPROVED），PENDING（待审批）/DRAFT 对外不可见
      where: { studentId, approvalStatus: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
    // ★ 2026-08-13 为每条证书生成 QR data URL + previewHtml（与 PDF 同一渲染源）
    const results = await Promise.all(certs.map(async (cert) => {
      const qrDataUrl = await this.generateQrDataUrl(cert.certificateNo, cert.verificationCode);
      const previewHtml = cert.templateId ? await this.buildPreviewHtml(cert) : null;
      return { ...cert, qrDataUrl, previewHtml };
    }));
    return results;
  }

  /** 生成证书 QR 码 data URL（带 HMAC 签名防伪） */
  async generateQrDataUrl(certificateNo: string, verificationCode: string): Promise<string> {
    try {
      const QRCode = await import('qrcode');
      const { signCertificateQrData } = await import('./cert-verify-utils.js');
      const siteUrl = process.env.SITE_URL || 'https://foxlearn.cn';
      const sig = signCertificateQrData(certificateNo, verificationCode);
      return await QRCode.toDataURL(
        `${siteUrl}/verify-certificate?no=${certificateNo}&code=${verificationCode}&sig=${sig}`,
        { width: 120, margin: 1, color: { dark: '#3a3028', light: '#ffffff00' } }
      );
    } catch {
      return '';
    }
  }

  /** 将本地文件路径转为 base64 data URL（供 Puppeteer 渲染） */
  private async toDataUrl(filePath: string): Promise<string | null> {
    try {
      // 只处理本地上传路径
      if (!filePath.startsWith('/uploads/')) return filePath; // 外部URL直接用
      const absPath = path.resolve(import.meta.dirname, '..', '..', '..', filePath.slice(1));
      const buf = await fs.readFile(absPath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      const mime = mimeMap[ext] || 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null; // 文件不存在时静默失败
    }
  }

  /** ★ 2026-08-13 构建证书模板渲染数据（PDF 与前端预览 previewHtml 共用）。
   *  机构配置注入规则与下方静态 HTML 分支一致：签发单位/底部文字/Logo/印章 + 身份证脱敏。 */
  private async buildTemplateData(cert: any, org: any = null): Promise<TemplateData> {
    const qrDataUrl = await this.generateQrDataUrl(cert.certificateNo, cert.verificationCode);
    // 查询学员身份证
    const studentUser = await this.prisma.user.findUnique({
      where: { id: cert.studentId },
      select: { idCard: true },
    });
    const rawIdCard = studentUser?.idCard || '';
    const maskedIdCard = rawIdCard.length >= 10
      ? rawIdCard.slice(0, 3) + '***' + rawIdCard.slice(-4)
      : rawIdCard;

    // ★ 2026-08-13 机构配置注入模板：签发单位/底部文字/Logo/印章（useFoxLearnSeal=true → 印章不注入，seal 元素回退内置环形章）
    const issuerName = cert.issuerName || org?.certIssuerName || org?.name || 'FoxLearn 狐学';
    const footerText = org?.certFooterText || '本证书最终解释权归 ' + issuerName + ' 所有 · 扫描二维码可在线验证';
    const logoSrc = org?.certLogoUrl ? await this.toDataUrl(org.certLogoUrl) : null;
    const sealSrc = (!org?.useFoxLearnSeal && org?.sealUrl) ? await this.toDataUrl(org.sealUrl) : null;

    return {
      studentName: cert.studentName,
      courseName: cert.courseName,
      certificateNo: cert.certificateNo,
      issueDate: cert.issueDate.toISOString().slice(0, 10),
      orgName: issuerName, // 兼容旧模板 {{orgName}}，也吃签发单位
      issuerName,
      footerText,
      orgLogoDataUrl: logoSrc ?? undefined,
      orgSealDataUrl: sealSrc ?? undefined,
      idCard: rawIdCard,
      idCardMasked: maskedIdCard,
      verificationCode: cert.verificationCode.slice(0, 8).toUpperCase(),
      qrDataUrl,
    };
  }

  /** ★ 2026-08-13 结课证书前端预览 HTML（canvas 渲染，与 PDF 同 data + 同模板选择逻辑）。
   *  仅定格模板（templateId）的记录渲染以控负载；无模板返回 null → 前端回退静态组件。 */
  private async buildPreviewHtml(cert: any): Promise<string | null> {
    if (!cert.templateId) return null;
    const tpl = await this.prisma.certificateTemplate.findUnique({ where: { id: cert.templateId } });
    if (!tpl) return null;
    const canvas = tpl.canvasJson as unknown as CanvasDef;
    // 列表查询的 cert 无 org relation include，单独查机构证书配置（与 generatePdf 的 cert.org 同构）
    const org = cert.orgId ? await this.prisma.organization.findUnique({
      where: { id: cert.orgId },
      select: { certIssuerName: true, certLogoUrl: true, certFooterText: true, sealUrl: true, useFoxLearnSeal: true, name: true },
    }) : null;
    return this.certTemplatesService.renderFragment(canvas, await this.buildTemplateData(cert, org), 1, 'preview');
  }

  /** 生成证书 PDF */
  async generatePdf(id: number): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: { org: { select: { certIssuerName: true, certLogoUrl: true, certFooterText: true, sealUrl: true, useFoxLearnSeal: true, name: true } } },
    });
    if (!cert) throw new NotFoundException('证书不存在');

    // ★ 2026-08-14 审批门控（模型 A：确认出证 + 审批解锁）：PENDING 证书不可下载，批准后才对外生效
    if (cert.approvalStatus === 'PENDING') {
      throw new BadRequestException('证书尚未审批通过，无法下载');
    }

    // ── 优先使用证书记录的模板，其次组织默认模板（平滑过渡） ──
    let renderTemplate = cert.templateId
      ? await this.prisma.certificateTemplate.findUnique({ where: { id: cert.templateId } })
      : null;
    if (!renderTemplate) {
      renderTemplate = await this.certTemplatesService.findDefaultTemplate(cert.orgId, 'COMPLETION');
    }
    if (renderTemplate) {
      const canvas = renderTemplate.canvasJson as unknown as CanvasDef;
      // ★ 2026-08-13 抽公共 buildTemplateData：PDF 与前端预览 previewHtml 共用同一份渲染数据
      const templateData = await this.buildTemplateData(cert, cert.org);
      return this.certTemplatesService.renderPdf(canvas, templateData);
    }

    // 读取模板文件
    const templatePath = path.resolve(
      import.meta.dirname, 'templates', 'certificate.html'
    );
    let html = await fs.readFile(templatePath, 'utf-8');

    // 替换模板变量（防 XSS：转义 HTML 特殊字符）
    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // 生成 QR 码
    const qrDataUrl = await this.generateQrDataUrl(cert.certificateNo, cert.verificationCode);

    // 动态签发单位
    const issuerName = cert.issuerName || cert.org?.certIssuerName || cert.org?.name || 'FoxLearn 狐学';
    const footerText = cert.org?.certFooterText || '本证书最终解释权归 ' + issuerName + ' 所有 · 扫描二维码可在线验证';
    // 将本地图片转 base64（Puppeteer setContent 无法加载相对路径）
    const logoSrc = cert.org?.certLogoUrl ? await this.toDataUrl(cert.org.certLogoUrl) : null;
    const sealSrc = (!cert.org?.useFoxLearnSeal && cert.org?.sealUrl) ? await this.toDataUrl(cert.org.sealUrl) : null;
    const logoHtml = logoSrc
      ? '<img src="' + logoSrc + '" style="height:36px;margin-bottom:4px;" alt="logo" />'
      : '';
    const sealHtml = sealSrc
      ? '<img src="' + sealSrc + '" style="width:80px;height:80px;opacity:0.85;" alt="seal" />'
      : '';

    html = html
      .replace(/{{studentName}}/g, escapeHtml(cert.studentName))
      .replace(/{{courseName}}/g, escapeHtml(cert.courseName))
      .replace(/{{certificateNo}}/g, escapeHtml(cert.certificateNo))
      .replace(/{{issueDate}}/g, escapeHtml(cert.issueDate.toISOString().slice(0, 10)))
      .replace(/{{verificationCode}}/g, escapeHtml(cert.verificationCode.slice(0, 8).toUpperCase()))
      .replace(/{{qrDataUrl}}/g, qrDataUrl)
      .replace(/{{issuerName}}/g, escapeHtml(issuerName))
      .replace(/{{footerText}}/g, escapeHtml(footerText))
      .replace(/{{logoHtml}}/g, logoHtml)
      .replace(/{{sealHtml}}/g, sealHtml);

    // 动态导入 puppeteer
    const puppeteer = await import('puppeteer');

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

  async listApplications(params: { status?: string; page?: number; limit?: number; userOrgId?: number | null; userRoles?: string[] }) {
    const where: any = {};
    // org filter for listApplications
    const appRoles = params.userRoles ?? [];
    if (!appRoles.includes('SUPER_ADMIN') && (params.userOrgId ?? null) !== null) {
      const visIds = await this.resourceAccess.getVisibleOrgIds(params.userOrgId!);
      where.OR = [{ orgId: { in: visIds } }, { orgId: null }];
    }
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
    // Get session->exam mapping（★ 2026-08-12 补决策信息：培训项目/成绩/违规，供审批人判断）
    const sessionIds = items.map(i => i.sessionId);
    const sessions = sessionIds.length > 0 ? await this.prisma.examSession.findMany({
      where: { id: { in: sessionIds } },
      select: {
        id: true,
        status: true,
        finalScore: true,
        totalScore: true,
        scoringStatus: true,
        isPassed: true,
        suspicionLevel: true,
        violationLog: true,
        submittedAt: true,
        exam: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            startTime: true,
            program: { select: { name: true, courseName: true } },
            org: { select: { name: true } },
          },
        },
      },
    }) : [];
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    return { items: items.map(i => ({ ...i, student: userMap.get(i.studentId) || null, examSession: sessionMap.get(i.sessionId) || null })), total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
  }

  async approveApplication(id: number, operatorId: number, caller?: { userOrgId?: number | null; userRoles?: string[] }) {
    const app = await this.prisma.certificateApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') throw new BadRequestException('只有待审批的申请可以操作');
    // ★ 发证前置校验（2026-08-12 修复）：成绩未发布/未通过 → 抛错阻止批准，杜绝"批准了但证书没生成"
    //   原实现 catch{} 吞掉发证异常，导致审批标记 APPROVED、学员收到通过通知但无证书
    //   已有有效证书 → 直接关联（幂等，不重复发证）：覆盖"成绩确认已自动发证但申请残留 PENDING"等脏数据场景
    let certificateId = app.certificateId;
    if (!certificateId) {
      const existing = await this.prisma.certificate.findFirst({
        where: { examSessionId: app.sessionId, studentId: app.studentId, isRevoked: false },
        select: { id: true },
      });
      // ★ 2026-08-16 带 caller 上下文发证：机构审批人同样受 cert_org_self_issue 约束，防绕过自行发证
      certificateId = existing?.id ?? (await this.issueSingleCertificate(app.sessionId, app.studentId, caller))?.id ?? null;
    }
    const result = await this.prisma.certificateApplication.update({
      where: { id },
      data: { status: 'APPROVED', certificateId, reviewedBy: operatorId, reviewedAt: new Date() },
    });
    // ★ 同步证书审批状态（2026-08-13 修复）：申请已批准 → 关联证书必须同步 APPROVED
    //   原实现只更新申请状态；cert_approval_required=true 时证书仍是 PENDING
    //   → /certificates（读证书表）显示「待审批」而 /certificates/applications（读申请表）显示「已批准」，两页状态不一致
    if (certificateId) {
      await this.prisma.certificate.update({
        where: { id: certificateId },
        data: { approvalStatus: 'APPROVED', approvedBy: operatorId, approvedAt: new Date() },
      }).catch(() => {});
    }
    // ← 审批日志（★ 2026-08-14 修正：此前误存 app.id，应存真实证书 id）
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId }, select: { displayName: true } });
    await this.prisma.certificateApprovalLog.create({
      data: { certificateId: certificateId || 0, action: 'APPROVED', operatorId, operatorName: operator?.displayName || '系统', note: null },
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
    // ★ 2026-08-16 反向同步（语义分离）：驳回 = 审批拒绝 → 关联证书 approvalStatus=REJECTED（not isRevoked 撤销）。
    //   此前用 isRevoked=true 表达驳回，导致申请页「已驳回」而证书管理页显示「已撤销」、REJECTED 筛选永远为空。
    const certId = app.certificateId || null;
    if (certId) {
      const cert = await this.prisma.certificate.findUnique({ where: { id: certId }, select: { approvalStatus: true, isRevoked: true } });
      if (cert && !cert.isRevoked && cert.approvalStatus === 'PENDING') {
        await this.prisma.certificate.update({
          where: { id: certId },
          data: { approvalStatus: 'REJECTED', rejectReason: reason || '申请被驳回', approvedBy: operatorId, approvedAt: new Date() },
        });
      }
    }
    // ← 审批日志（★ 2026-08-14 修正：此前误存 app.id，应存真实证书 id）
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId }, select: { displayName: true } });
    await this.prisma.certificateApprovalLog.create({
      data: { certificateId: certId || 0, action: 'REJECTED', operatorId, operatorName: operator?.displayName || '系统', note: reason || null },
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
