-- 审计日志增加操作来源字段：标记记录来自用户手动操作(MANUAL)/API接口(API)/系统自动(SYSTEM)/定时任务(CRON)。
-- 该列此前已由 `prisma db push` 直接推入数据库，本迁移补齐迁移记录。

ALTER TABLE `audit_logs` ADD COLUMN `event_source` VARCHAR(20) NULL;
