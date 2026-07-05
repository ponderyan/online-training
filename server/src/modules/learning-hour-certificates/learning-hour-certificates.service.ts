import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface FindAllParams extends PaginationParams {
  studentId?: number;
  programId?: number;
  status?: string;
}

@Injectable()
export class LearningHourCertificatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成证书编号
   * 格式：FX-HOURS-{YYYYMMDD}-{4位流水号}
   */
  async generateNo(org?: { code?: string }): Promise<string> {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const prefix = `FX-HOURS-${dateStr}-`;

    // 查询当天已发的最大流水号
    const lastCert = await this.prisma.learningHourCertificate.findFirst({
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

  /**
   * 申请学时证明
   */
  /** 计算印章哈希 + base64 data URL */
  private async loadSealData() {
    const path = await import('path');
    const fs = await import('fs/promises');
    const sealPath = path.resolve(process.cwd(), 'assets/seal-foxlearn.svg');
    let sealHash = '';
    let sealDataUrl = '';
    try {
      const sealBuffer = await fs.readFile(sealPath);
      sealHash = crypto.createHash('sha256').update(sealBuffer).digest('hex');
      sealDataUrl = `data:image/svg+xml;base64,${sealBuffer.toString('base64')}`;
    } catch {
      console.warn('[LearningHourCertificate] 印章文件未找到，跳过哈希计算');
    }
    return { sealHash, sealDataUrl };
  }

  async apply(studentId: number, programId: number) {
    // 1. 验证学员是否在培训班中
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { programId_studentId: { programId, studentId } },
    });
    if (!enrollment) {
      throw new BadRequestException('您未报名该培训班，无法申请学时证明');
    }

    // 2. 检查是否已有该培训班的学时证明
    const existing = await this.prisma.learningHourCertificate.findFirst({
      where: { studentId, programId, isRevoked: false },
    });
    if (existing) {
      throw new BadRequestException('您已申请过该培训班的学时证明，请勿重复申请');
    }

    // 3. 聚合 APPROVED 学时记录，按 typeId 分组
    const approvedRecords = await this.prisma.learningHourRecord.findMany({
      where: {
        studentId,
        programId,
        status: 'APPROVED',
      },
      include: {
        type: { select: { id: true, name: true, code: true } },
      },
    });

    if (approvedRecords.length === 0) {
      throw new BadRequestException('您在该培训班尚无已审核通过的学时记录，无法申请学时证明');
    }

    // 4. 按类型聚合
    const hoursMap = new Map<string, { typeName: string; typeCode: string; hours: number }>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const r of approvedRecords) {
      const key = r.type?.code || 'OTHER';
      const existing = hoursMap.get(key);
      if (existing) {
        existing.hours += r.hours;
      } else {
        hoursMap.set(key, {
          typeName: r.type?.name || '其他',
          typeCode: key,
          hours: r.hours,
        });
      }

      // 计算最早/最晚记录日期
      const recordedAt = r.recordedAt;
      if (!minDate || recordedAt < minDate) minDate = recordedAt;
      if (!maxDate || recordedAt > maxDate) maxDate = recordedAt;
    }

    const totalHours = approvedRecords.reduce((sum, r) => sum + r.hours, 0);
    const hoursDetail = Array.from(hoursMap.values()).map(t => ({
      ...t,
      hours: Math.round(t.hours * 100) / 100,
    }));

    // 5. 生成编号和验证码
    const certificateNo = await this.generateNo();
    const verificationCode = crypto.randomBytes(16).toString('hex');

    // 6. 获取学员信息和培训班信息
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { displayName: true, idCard: true, organization: true },
    });

    const program = await this.prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: { name: true, org: { select: { id: true, name: true } } },
    });

    // 7. 计算印章哈希
    const { sealHash } = await this.loadSealData().catch(() => ({ sealHash: '' }));

    // 8. 创建学时证明记录
    const certificate = await this.prisma.learningHourCertificate.create({
      data: {
        studentId,
        programId,
        studentName: student?.displayName || '',
        idCard: student?.idCard || null,
        programName: program?.name || null,
        orgName: program?.org?.name || student?.organization || null,
        totalHours: Math.round(totalHours * 100) / 100,
        hoursDetail,
        startDate: minDate,
        endDate: maxDate,
        certificateNo,
        verificationCode,
        contentHash: sealHash || null,
        sealHash: sealHash || null,
        approvalStatus: 'AUTO_APPROVED',
        appliedAt: new Date(),
        approvedAt: new Date(),
        orgId: program?.org?.id || null,
      },
    });

    return certificate;
  }

  /**
   * 分页查询学时证明（后台管理）
   */
  async findAll(params: FindAllParams) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};

    if (params.studentId) where.studentId = params.studentId;
    if (params.programId) where.programId = params.programId;
    if (params.status) where.approvalStatus = params.status;

    const [items, total] = await Promise.all([
      this.prisma.learningHourCertificate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.learningHourCertificate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取当前学员的学时证明列表
   */
  async findMy(studentId: number) {
    return this.prisma.learningHourCertificate.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取单个学时证明详情
   */
  async findOne(id: number) {
    const cert = await this.prisma.learningHourCertificate.findUnique({
      where: { id },
    });
    if (!cert) throw new NotFoundException('学时证明不存在');
    return cert;
  }

  /**
   * 审核学时证明
   */
  async review(id: number, action: 'approve' | 'reject', reviewerId: number, note?: string) {
    const cert = await this.prisma.learningHourCertificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('学时证明不存在');
    if (cert.approvalStatus !== 'AUTO_APPROVED' && cert.approvalStatus !== 'PENDING') {
      throw new BadRequestException('该学时证明已审核，无法重复操作');
    }

    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    return this.prisma.learningHourCertificate.update({
      where: { id },
      data: {
        approvalStatus: status,
        approvedBy: reviewerId,
        approvedAt: new Date(),
        reviewNote: note || null,
      },
    });
  }

  /**
   * 吊销学时证明
   */
  async revoke(id: number, reason: string, reviewerId: number) {
    const cert = await this.prisma.learningHourCertificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('学时证明不存在');
    if (cert.isRevoked) throw new BadRequestException('该学时证明已被吊销');

    return this.prisma.learningHourCertificate.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
        approvedBy: reviewerId,
      },
    });
  }

  /**
   * 预览学时聚合（不创建证明）
   */
  async preview(studentId: number, programId: number) {
    const approvedRecords = await this.prisma.learningHourRecord.findMany({
      where: {
        studentId,
        programId,
        status: 'APPROVED',
      },
      include: {
        type: { select: { id: true, name: true, code: true } },
      },
    });

    if (approvedRecords.length === 0) {
      return {
        totalHours: 0,
        hoursDetail: [],
        recordCount: 0,
        message: '该培训班暂无已审核通过的学时记录',
      };
    }

    const hoursMap = new Map<string, { typeName: string; typeCode: string; hours: number }>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const r of approvedRecords) {
      const key = r.type?.code || 'OTHER';
      const existing = hoursMap.get(key);
      if (existing) {
        existing.hours += r.hours;
      } else {
        hoursMap.set(key, {
          typeName: r.type?.name || '其他',
          typeCode: key,
          hours: r.hours,
        });
      }

      if (!minDate || r.recordedAt < minDate) minDate = r.recordedAt;
      if (!maxDate || r.recordedAt > maxDate) maxDate = r.recordedAt;
    }

    const totalHours = approvedRecords.reduce((sum, r) => sum + r.hours, 0);

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      hoursDetail: Array.from(hoursMap.values()).map(t => ({
        ...t,
        hours: Math.round(t.hours * 100) / 100,
      })),
      startDate: minDate,
      endDate: maxDate,
      recordCount: approvedRecords.length,
    };
  }

  /**
   * 公开查询学时证明
   * 通过 certificateNo 查询，自动遮罩身份证号
   */
  async verify(certificateNo: string) {
    const cert = await this.prisma.learningHourCertificate.findUnique({
      where: { certificateNo },
    });
    if (!cert) {
      return { valid: false, message: '学时证明不存在' };
    }

    // 遮罩身份证号
    const maskIdCard = (idCard?: string | null) => {
      if (!idCard || idCard.length < 10) return idCard || '';
      return idCard.slice(0, 6) + '********' + idCard.slice(-4);
    };

    return {
      valid: !cert.isRevoked,
      certificate: {
        studentName: cert.studentName,
        idCardMasked: maskIdCard(cert.idCard),
        programName: cert.programName,
        orgName: cert.orgName,
        totalHours: cert.totalHours,
        hoursDetail: cert.hoursDetail,
        startDate: cert.startDate,
        endDate: cert.endDate,
        certificateNo: cert.certificateNo,
        issueDate: cert.createdAt,
        approvalStatus: cert.approvalStatus,
        isRevoked: cert.isRevoked,
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason,
        contentHash: cert.contentHash,
        sealHash: cert.sealHash,
      },
    };
  }

  /**
   * 生成学时证明 PDF（含 QR 码 + 印章图片 + 哈希校验 + 盲水印）
   */
  async generatePdf(id: number): Promise<Buffer> {
    const cert = await this.prisma.learningHourCertificate.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException('学时证明不存在');

    const fs = await import('fs/promises');
    const path = await import('path');

    // 动态导入 puppeteer
    const puppeteer = await import('puppeteer');

    // 生成 QR 码（verify URL 动态化：使用 SITE_URL 环境变量）
    let qrDataUrl = '';
    try {
      const qrcode = await import('qrcode');
      const baseUrl = process.env.SITE_URL || 'https://foxlearn.cn';
      const verifyUrl = `${baseUrl}/verify-hours?no=${cert.certificateNo}`;
      qrDataUrl = await qrcode.toDataURL(verifyUrl, { width: 120, margin: 2 });
    } catch {
      qrDataUrl = '';
    }

    // 读取印章 SVG → base64 data URL + SHA256
    const sealPath = path.resolve(process.cwd(), 'assets/seal-foxlearn.svg');
    let sealHash = cert.contentHash || '';
    let sealDataUrl = '';
    try {
      const sealBuffer = await fs.readFile(sealPath);
      if (!sealHash) {
        sealHash = crypto.createHash('sha256').update(sealBuffer).digest('hex');
        await this.prisma.learningHourCertificate.update({
          where: { id },
          data: { contentHash: sealHash, sealHash },
        }).catch(() => {});
      }
      sealDataUrl = `data:image/svg+xml;base64,${sealBuffer.toString('base64')}`;
    } catch {
      console.warn('[LearningHourCertificate] 印章文件未找到');
    }

    // 读取模板
    const templatePath = path.resolve(
      import.meta.dirname, 'templates', 'learning-hour-certificate.html'
    );
    let html = await fs.readFile(templatePath, 'utf-8');

    // 转义 HTML
    const escapeHtml = (s: unknown) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // 遮罩身份证号
    const maskIdCard = (idCard?: string | null) => {
      if (!idCard || idCard.length < 10) return idCard || '';
      return idCard.slice(0, 6) + '********' + idCard.slice(-4);
    };

    // 构建学时明细表格 HTML
    const hoursDetailHtml = (Array.isArray(cert.hoursDetail) ? cert.hoursDetail : [])
      .map((item: any) => {
        const typeName = escapeHtml(item.typeName || '其他');
        const hours = typeof item.hours === 'number' ? item.hours.toFixed(1) : '0.0';
        return `<tr><td>${typeName}</td><td class="hours-cell">${hours}</td></tr>`;
      })
      .join('');

    const totalHoursStr = typeof cert.totalHours === 'number' ? cert.totalHours.toFixed(1) : '0.0';
    const startDateStr = cert.startDate ? new Date(cert.startDate).toISOString().slice(0, 10) : '';
    const endDateStr = cert.endDate ? new Date(cert.endDate).toISOString().slice(0, 10) : '';
    const issueDateStr = new Date(cert.createdAt).toISOString().slice(0, 10);

    html = html
      .replace(/{{studentName}}/g, escapeHtml(cert.studentName))
      .replace(/{{idCardMasked}}/g, maskIdCard(cert.idCard))
      .replace(/{{programName}}/g, escapeHtml(cert.programName || ''))
      .replace(/{{orgName}}/g, escapeHtml(cert.orgName || ''))
      .replace(/{{hoursDetailTable}}/g, hoursDetailHtml)
      .replace(/{{totalHours}}/g, totalHoursStr)
      .replace(/{{startDate}}/g, startDateStr)
      .replace(/{{endDate}}/g, endDateStr)
      .replace(/{{certificateNo}}/g, escapeHtml(cert.certificateNo))
      .replace(/{{issueDate}}/g, issueDateStr)
      .replace(/{{qrDataUrl}}/g, qrDataUrl)
      .replace(/{{sealDataUrl}}/g, sealDataUrl)
      .replace(/{{sealHash}}/g, escapeHtml(sealHash));

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      // 尝试嵌入盲水印（失败不阻塞）
      try {
        const { execSync } = await import('child_process');
        const tempPdfPath = path.resolve('/tmp', `hours-cert-${id}-${Date.now()}.pdf`);
        await fs.writeFile(tempPdfPath, pdf);
        execSync(`python3 scripts/embed_watermark.py "${tempPdfPath}" "${cert.certificateNo}"`, {
          timeout: 10000,
          cwd: import.meta.dirname + '/../../',
          stdio: 'pipe',
        });
        const watermarked = await fs.readFile(tempPdfPath);
        await fs.unlink(tempPdfPath).catch(() => {});
        return Buffer.from(watermarked);
      } catch {
        console.warn('[LearningHourCertificate] 盲水印嵌入失败，返回原始PDF');
        return Buffer.from(pdf);
      }
    } finally {
      await browser.close();
    }
  }
}
