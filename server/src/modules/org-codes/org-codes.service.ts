import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemConfigService } from '../system-config/system-config.service.js';

@Injectable()
export class OrgCodesService {
  constructor(private prisma: PrismaService, private systemConfig: SystemConfigService) {}

  // ═══════════════════════════════════════════
  //  缩写词典 CRUD
  // ═══════════════════════════════════════════

  async getAbbreviations() {
    return this.prisma.orgAbbreviation.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createAbbreviation(data: { keyword: string; abbr: string; category?: string; sortOrder?: number }) {
    if (!data.keyword || !data.abbr) throw new BadRequestException('关键词和缩写不能为空');
    const existing = await this.prisma.orgAbbreviation.findUnique({ where: { keyword: data.keyword } });
    if (existing) throw new ConflictException(`关键词「${data.keyword}」已存在`);
    return this.prisma.orgAbbreviation.create({ data });
  }

  async updateAbbreviation(id: number, data: { keyword?: string; abbr?: string; category?: string; sortOrder?: number }) {
    return this.prisma.orgAbbreviation.update({ where: { id }, data });
  }

  async deleteAbbreviation(id: number) {
    return this.prisma.orgAbbreviation.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════
  //  编码规则配置
  // ═══════════════════════════════════════════

  async getCodeRules() {
    const configs = await this.systemConfig.getConfigs([
      'org_code_separator',
      'org_code_auto_generate',
      'org_code_include_level',
    ]);
    return {
      separator: configs.get('org_code_separator') || '-',
      autoGenerate: configs.get('org_code_auto_generate') === 'true',
      includeLevel: configs.get('org_code_include_level') === 'true',
    };
  }

  async updateCodeRules(data: { separator?: string; autoGenerate?: boolean; includeLevel?: boolean }) {
    if (data.separator !== undefined) {
      await this.systemConfig.setConfig('org_code_separator', data.separator);
    }
    if (data.autoGenerate !== undefined) {
      await this.systemConfig.setConfig('org_code_auto_generate', String(data.autoGenerate));
    }
    if (data.includeLevel !== undefined) {
      await this.systemConfig.setConfig('org_code_include_level', String(data.includeLevel));
    }
    return this.getCodeRules();
  }

  // ═══════════════════════════════════════════
  //  编码自动生成（核心逻辑）
  // ═══════════════════════════════════════════

  /**
   * 根据父组织和名称生成编码
   * 策略：父编码 + 分隔符 + 缩写（词典匹配 > 英文提取 > 拼音首字母兜底）
   */
  async generateCode(parentId: number | null | undefined, name: string): Promise<string> {
    const rules = await this.getCodeRules();
    const sep = rules.separator;

    // 获取父编码
    let parentCode = '';
    if (parentId && rules.includeLevel) {
      const parent = await this.prisma.organization.findUnique({ where: { id: parentId }, select: { code: true } });
      parentCode = parent?.code || '';
    }

    // 生成缩写部分
    const abbr = await this.resolveAbbreviation(name);

    // 拼接
    let code = parentCode ? `${parentCode}${sep}${abbr}` : abbr;

    // 确保格式合规（大写，2-20位）
    code = code.toUpperCase().substring(0, 20);
    if (code.length < 2) code = code + '01';

    // 查重 + 后缀
    code = await this.ensureUnique(code);

    return code;
  }

  /**
   * 预览编码（不查重，用于前端实时展示）
   */
  async previewCode(parentId: number | null | undefined, name: string): Promise<string> {
    const rules = await this.getCodeRules();
    const sep = rules.separator;

    let parentCode = '';
    if (parentId && rules.includeLevel) {
      const parent = await this.prisma.organization.findUnique({ where: { id: parentId }, select: { code: true } });
      parentCode = parent?.code || '';
    }

    const abbr = await this.resolveAbbreviation(name);
    let code = parentCode ? `${parentCode}${sep}${abbr}` : abbr;
    return code.toUpperCase().substring(0, 20);
  }

  /**
   * 从名称解析缩写：词典精确 > 词典包含 > 英文提取 > 首字母兜底
   */
  private async resolveAbbreviation(name: string): Promise<string> {
    const dict = await this.prisma.orgAbbreviation.findMany({ orderBy: { sortOrder: 'asc' } });

    // 1. 精确匹配
    const exact = dict.find(d => d.keyword === name);
    if (exact) return exact.abbr;

    // 2. 包含匹配（名称包含关键词）
    const contains = dict.find(d => name.includes(d.keyword));
    if (contains) return contains.abbr;

    // 3. 英文提取
    const englishMatch = name.match(/[A-Za-z]+/g);
    if (englishMatch && englishMatch.length > 0) {
      return englishMatch[0].toUpperCase().substring(0, 6);
    }

    // 4. 兜底：取名称前两个字符的 Unicode 编码简写
    const cleaned = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    if (cleaned.length >= 2) {
      return `ORG${cleaned.length}`;
    }
    return 'NEW';
  }

  /**
   * 确保编码唯一，冲突时追加数字后缀
   */
  private async ensureUnique(code: string): Promise<string> {
    const existing = await this.prisma.organization.findUnique({ where: { code } });
    if (!existing) return code;

    for (let i = 2; i <= 99; i++) {
      const candidate = `${code}${i}`.substring(0, 20);
      const found = await this.prisma.organization.findUnique({ where: { code: candidate } });
      if (!found) return candidate;
    }
    throw new BadRequestException('无法生成唯一编码，请手动指定');
  }
}
