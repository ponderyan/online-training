import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * 系统配置服务（带进程内缓存）
 *
 * 缓存策略：首次读库放入内存 Map，setConfig 时同时更新 DB 和缓存。
 * 单进程部署足够，后续可改为 Redis。
 */
@Injectable()
export class SystemConfigService {
  private cache = new Map<string, { value: string; updatedAt: Date }>();
  private loaded = false;

  constructor(private prisma: PrismaService) {}

  /**
   * 一次性加载所有配置到缓存
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const rows = await this.prisma.systemConfig.findMany();
    for (const row of rows) {
      this.cache.set(row.key, { value: row.value, updatedAt: row.updatedAt });
    }
    this.loaded = true;
  }

  /**
   * 获取配置值（字符串）
   */
  async getConfig(key: string): Promise<string | null> {
    await this.ensureLoaded();
    const entry = this.cache.get(key);
    return entry ? entry.value : null;
  }

  /**
   * 获取布尔型配置值
   */
  async getBoolean(key: string): Promise<boolean> {
    const val = await this.getConfig(key);
    return val === 'true';
  }

  /**
   * 设置配置值（同时更新 DB 和缓存）
   */
  async setConfig(key: string, value: string, desc?: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, desc },
      create: { key, value, desc },
    });
    this.cache.set(key, { value, updatedAt: new Date() });
  }
}
