import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

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

    // 审计日志
    if (operatorId) {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'SystemConfig',
          entityId: existing.id,
          action: 'UPDATE',
          before: { value: existing.value },
          after: { value },
          operatorId,
        },
      });
    }

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
  async sync(configs: { key: string; value: string; desc?: string; group?: string; inputType?: string; options?: string }[]) {
    let count = 0;
    for (const cfg of configs) {
      await this.prisma.systemConfig.upsert({
        where: { key: cfg.key },
        update: { value: cfg.value, desc: cfg.desc, group: cfg.group, inputType: cfg.inputType, options: cfg.options },
        create: cfg,
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
