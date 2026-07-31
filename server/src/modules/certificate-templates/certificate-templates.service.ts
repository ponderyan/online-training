import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { renderCanvasToDocument, renderCanvasToHtml } from './renderer/canvas-renderer.js';
import type { CanvasDef, TemplateData, RenderMode } from './renderer/canvas-types.js';

@Injectable()
export class CertificateTemplatesService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════

  /** 列表（org 隔离：SUPER_ADMIN 看全部，org 用户看本 org + 平台级） */
  async findAll(userOrgId: number | null, isSuperAdmin: boolean, filters?: { type?: string; isActive?: boolean; search?: string; sortBy?: string }) {
    const where: any = {};
    if (!isSuperAdmin && userOrgId) {
      where.OR = [{ orgId: userOrgId }, { orgId: null }];
    }
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      const kw = filters.search.trim();
      where.AND = [{ OR: [{ name: { contains: kw } }, { description: { contains: kw } }] }];
    }

    // 排序
    let orderBy: any;
    switch (filters?.sortBy) {
      case 'name': orderBy = [{ name: 'asc' }]; break;
      case 'createdAt': orderBy = [{ createdAt: 'desc' }]; break;
      case 'updatedAt': orderBy = [{ updatedAt: 'desc' }]; break;
      default: orderBy = [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }];
    }

    const rows = await this.prisma.certificateTemplate.findMany({
      where,
      orderBy,
      select: {
        id: true, name: true, type: true, description: true,
        thumbnail: true, isDefault: true, isActive: true,
        orgId: true, createdBy: true, createdAt: true, updatedAt: true,
      },
    });

    // join 创建者姓名
    const userIds = [...new Set(rows.map(r => r.createdBy).filter(Boolean))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true } })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.displayName || u.username]));
    return rows.map(r => ({ ...r, creatorName: userMap.get(r.createdBy) || `用户#${r.createdBy}` }));
  }

  /** 详情 */
  async findById(id: number, userOrgId: number | null, isSuperAdmin: boolean) {
    const tpl = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('模板不存在');
    if (!isSuperAdmin && userOrgId && tpl.orgId && tpl.orgId !== userOrgId) {
      throw new ForbiddenException('无权访问此模板');
    }
    return tpl;
  }

  /** 创建 */
  async create(data: {
    name: string;
    description?: string;
    type?: string;
    canvasJson: any;
    orgId?: number | null;
    isDefault?: boolean;
  }, userId: number, userOrgId: number | null) {
    const orgId = data.orgId ?? userOrgId ?? null;
    return this.prisma.certificateTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type || 'COMPLETION',
        canvasJson: data.canvasJson,
        orgId,
        isDefault: data.isDefault || false,
        createdBy: userId,
      },
    });
  }

  /** 更新 */
  async update(id: number, data: Partial<{
    name: string;
    description: string;
    type: string;
    canvasJson: any;
    thumbnail: string;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  }>, userId: number, userOrgId: number | null, isSuperAdmin: boolean) {
    const existing = await this.findById(id, userOrgId, isSuperAdmin);
    // org 用户不能修改平台级模板
    if (!isSuperAdmin && !existing.orgId) {
      throw new ForbiddenException('无权修改平台级模板');
    }
    return this.prisma.certificateTemplate.update({
      where: { id },
      data: { ...data, updatedBy: userId },
    });
  }

  /** 删除（软删除：isActive=false） */
  async remove(id: number, userOrgId: number | null, isSuperAdmin: boolean) {
    const existing = await this.findById(id, userOrgId, isSuperAdmin);
    if (!isSuperAdmin && !existing.orgId) {
      throw new ForbiddenException('无权删除平台级模板');
    }
    return this.prisma.certificateTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** 硬删除 */
  async hardRemove(id: number, userOrgId: number | null, isSuperAdmin: boolean) {
    await this.findById(id, userOrgId, isSuperAdmin);
    return this.prisma.certificateTemplate.delete({ where: { id } });
  }

  /** 复制模板 */
  async duplicate(id: number, userId: number, userOrgId: number | null, isSuperAdmin: boolean) {
    const src = await this.findById(id, userOrgId, isSuperAdmin);
    return this.prisma.certificateTemplate.create({
      data: {
        name: `${src.name} (副本)`,
        description: src.description,
        type: src.type,
        canvasJson: src.canvasJson as any,
        orgId: userOrgId ?? src.orgId,
        createdBy: userId,
      },
    });
  }

  /** 设为组织默认模板 */
  async setDefault(id: number, userOrgId: number | null, isSuperAdmin: boolean) {
    const tpl = await this.findById(id, userOrgId, isSuperAdmin);
    // 取消同 org + 同 type 的其他默认
    await this.prisma.certificateTemplate.updateMany({
      where: { orgId: tpl.orgId, type: tpl.type, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.certificateTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /** 异步生成缩略图并更新 DB（fire-and-forget） */
  async regenerateThumbnail(id: number) {
    try {
      const tpl = await this.prisma.certificateTemplate.findUnique({ where: { id } });
      if (!tpl) return;
      const canvas = tpl.canvasJson as unknown as CanvasDef;
      const png = await this.renderThumbnail(canvas, {});
      // 存为 base64 data URL（简化方案，生产环境应存文件/OSS）
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
      await this.prisma.certificateTemplate.update({ where: { id }, data: { thumbnail: dataUrl } });
    } catch (e) {
      console.error('[CertTemplate] thumbnail generation failed:', e);
    }
  }

  // ═══════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════

  renderHtml(canvas: CanvasDef, data: TemplateData = {}, mode?: RenderMode): string {
    return renderCanvasToDocument(canvas, data, { mode });
  }

  renderFragment(canvas: CanvasDef, data: TemplateData = {}, scale = 1, mode?: RenderMode): string {
    return renderCanvasToHtml(canvas, data, { scale, mode });
  }

  async renderPdf(canvas: CanvasDef, data: TemplateData = {}, opts: { mode?: RenderMode; dpi?: number } = {}): Promise<Buffer> {
    const html = renderCanvasToDocument(canvas, data, { mode: opts.mode });
    // DPI → deviceScaleFactor: 96dpi=1x, 150dpi≈1.56x, 300dpi≈3.13x
    const dpi = opts.dpi || 150;
    const deviceScaleFactor = Math.max(1, Math.round((dpi / 96) * 100) / 100);
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: canvas.width, height: canvas.height, deviceScaleFactor });
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        width: `${canvas.width}px`,
        height: `${canvas.height}px`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        preferCSSPageSize: false,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async renderThumbnail(canvas: CanvasDef, data: TemplateData = {}): Promise<Buffer> {
    const html = renderCanvasToDocument(canvas, data);
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      // 缩略图目标宽度 ~600px，按比例缩放以降低 base64 体积（卡片展示足够）
      const dsf = Math.min(1, 600 / canvas.width);
      await page.setViewport({ width: canvas.width, height: canvas.height, deviceScaleFactor: dsf });
      await page.setContent(html, { waitUntil: 'load' });
      const png = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: canvas.width, height: canvas.height },
      });
      return Buffer.from(png);
    } finally {
      await browser.close();
    }
  }

  // ═══════════════════════════════════════════
  // 批量生成
  // ═══════════════════════════════════════════

  /**
   * 批量生成 PDF 并打包为 ZIP。
   * @param canvas 画布定义
   * @param rows 数据行数组（每行一个 TemplateData）
   * @param opts 渲染选项
   * @param onProgress 进度回调 (current, total)
   * @returns ZIP Buffer
   */
  async batchGeneratePdf(
    canvas: CanvasDef,
    rows: TemplateData[],
    opts: { mode?: RenderMode; dpi?: number; filenameField?: string } = {},
    onProgress?: (current: number, total: number) => void,
  ): Promise<Buffer> {
    const { ZipArchive } = await import('archiver') as any;

    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 6 } });
    // 收集输出数据
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    const streamEnd = new Promise<void>(resolve => archive.on('end', resolve));

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    const dpi = opts.dpi || 150;
    const deviceScaleFactor = Math.max(1, Math.round((dpi / 96) * 100) / 100);
    const filenameField = opts.filenameField || 'studentName';

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: canvas.width, height: canvas.height, deviceScaleFactor });

      for (let i = 0; i < rows.length; i++) {
        const data = rows[i];
        const html = renderCanvasToDocument(canvas, data, { mode: opts.mode });
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({
          width: `${canvas.width}px`,
          height: `${canvas.height}px`,
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
          preferCSSPageSize: false,
        });

        // 文件名：使用 filenameField 的值 + 序号
        const name = String(data[filenameField] || `cert_${i + 1}`).replace(/[\\/:*?"<>|]/g, '_');
        archive.append(Buffer.from(pdf), { name: `${String(i + 1).padStart(3, '0')}_${name}.pdf` });

        onProgress?.(i + 1, rows.length);
      }
    } finally {
      await browser.close();
    }

    await archive.finalize();
    await streamEnd;
    return Buffer.concat(chunks);
  }
}
