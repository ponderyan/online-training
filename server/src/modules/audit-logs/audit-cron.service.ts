import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * 审计日志定时归档清理
 * 每天凌晨 3:00 执行，读取 system_config 中 audit_retention_days 配置
 * 删除超期日志，防止数据无限增长
 */
@Injectable()
export class AuditCronService {
  private readonly logger = new Logger(AuditCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleAuditCleanup() {
    try {
      // 读取保留天数配置（默认 730 天 = 2 年）
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'audit_retention_days' },
      });
      const retentionDays = config ? parseInt(config.value, 10) || 730 : 730;

      // 读取是否启用自动清理
      const enabledConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'audit_auto_cleanup_enabled' },
      });
      const enabled = enabledConfig ? enabledConfig.value === 'true' : true;

      if (!enabled) {
        this.logger.log('审计日志自动清理已禁用，跳过');
        return;
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      if (result.count > 0) {
        this.logger.log(`[定时归档] 已清理 ${result.count} 条超过 ${retentionDays} 天的审计日志`);
      } else {
        this.logger.log(`[定时归档] 无超期日志需清理（保留 ${retentionDays} 天）`);
      }
    } catch (e: any) {
      this.logger.error(`[定时归档] 执行失败: ${e.message}`);
    }
  }
}
