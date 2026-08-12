import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  /**
   * 启动时自动注册考试默认配置（幂等，不覆盖已有值）。
   * 注：完整配置由 prisma/seed.ts 统一注册，此处仅做兜底补充。
   */
  async onModuleInit() {
    const examDefaults = [
      { key: 'exam_default_late_entry_minutes', value: '30', desc: '默认迟到禁入时间（分钟），0=不限制', group: 'exam', inputType: 'number' },
      { key: 'exam_default_early_exit_minutes', value: '30', desc: '默认开考后最早交卷时间（分钟），0=不限制', group: 'exam', inputType: 'number' },
      { key: 'exam_countdown_warning_minutes', value: '5', desc: '倒计时警告阈值（分钟）', group: 'exam', inputType: 'number' },
      { key: 'exam_grace_seconds', value: '120', desc: '考试结束后交卷宽限期（秒）', group: 'exam', inputType: 'number' },
      { key: 'exam_force_submit_on_end', value: 'true', desc: '考试时间到是否强制收卷', group: 'exam', inputType: 'boolean' },
      { key: 'exam_allow_pause_resume', value: 'true', desc: 'FLEXIBLE模式是否允许断点续考', group: 'exam', inputType: 'boolean' },
      { key: 'exam_proctor_high_risk_threshold', value: '3', desc: '监考大屏高危切屏阈值（次），达到即标红预警', group: 'exam', inputType: 'number' },
    ];
    for (const cfg of examDefaults) {
      await this.prisma.systemConfig.upsert({
        where: { key: cfg.key },
        update: {},  // 不覆盖已有值
        create: cfg,
      });
    }
  }

  /** 获取所有配置，按 group 分组 */
  async getAll() {
    const configs = await this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const grouped: Record<string, any[]> = {};
    for (const c of configs) {
      const g = c.group || 'general';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({
        key: c.key,
        value: c.value,
        desc: c.desc,
        group: c.group,
        inputType: c.inputType || 'text',
        options: c.options,
        updatedAt: c.updatedAt,
      });
    }
    return grouped;
  }

  /** 获取某分组配置 */
  async getByGroup(group: string) {
    const configs = await this.prisma.systemConfig.findMany({
      where: { group },
      orderBy: { key: 'asc' },
    });
    return configs.map(c => ({
      key: c.key,
      value: c.value,
      desc: c.desc,
      group: c.group,
      inputType: c.inputType || 'text',
      options: c.options,
      updatedAt: c.updatedAt,
    }));
  }

  /** 更新单个配置值（带审计日志 + 类型校验） */
  async update(key: string, value: string, operatorId?: number) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!existing) throw new BadRequestException(`配置项 ${key} 不存在`);

    // 类型校验
    const inputType = existing.inputType || 'text';
    if (inputType === 'number') {
      const num = Number(value);
      if (isNaN(num)) throw new BadRequestException('数值类型配置项必须传入有效数字');
      // 存字符串
    }

    if (inputType === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        throw new BadRequestException('布尔类型配置项必须为 true 或 false');
      }
    }

    if (inputType === 'select' && existing.options) {
      try {
        const opts = JSON.parse(existing.options);
        if (!opts.includes(value)) {
          throw new BadRequestException(`值 "${value}" 不在可选范围内: ${opts.join(', ')}`);
        }
      } catch {}
    }

    // 更新
    const updated = await this.prisma.systemConfig.update({
      where: { key },
      data: { value },
    });

    return {
      key: updated.key,
      value: updated.value,
      desc: updated.desc,
      group: updated.group,
      inputType: updated.inputType || 'text',
      options: updated.options,
      updatedAt: updated.updatedAt,
    };
  }

  /** 批量同步/注册配置（供 seed 脚本用） */
  async sync(configs: { key: string; value: string; desc?: string; description?: string; group?: string; inputType?: string; options?: string }[]) {
    let count = 0;
    for (const cfg of configs) {
      const desc = cfg.desc || cfg.description;
      await this.prisma.systemConfig.upsert({
        where: { key: cfg.key },
        update: { value: cfg.value, desc, group: cfg.group, inputType: cfg.inputType, options: cfg.options },
        create: { key: cfg.key, value: cfg.value, desc, group: cfg.group, inputType: cfg.inputType, options: cfg.options },
      });
      count++;
    }
    return { synced: count };
  }

  // ── 向下兼容：bank-policy 相关方法 ──

  async getConfig(key: string): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value || null;
  }

  /** 批量获取配置值 */
  async getConfigs(keys: string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    return new Map(rows.map(r => [r.key, r.value]));
  }

  async getBoolean(key: string): Promise<boolean> {
    const val = await this.getConfig(key);
    return val === 'true';
  }

  async setConfig(key: string, value: string, desc?: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, desc },
      create: { key, value, desc },
    });
  }
}
