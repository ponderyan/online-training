-- 审计日志增加操作原因字段：强制原因操作（成绩调分/证书吊销/删除等）和可选原因操作（编辑题目等）时记录变更原因。
-- 该列此前已由 `prisma db push` 直接推入数据库，本迁移补齐迁移记录。

ALTER TABLE `audit_logs` ADD COLUMN `change_reason` TEXT NULL;
