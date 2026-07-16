-- 通知批次标识：一次群发的多条通知共享同一 batchId，便于发送记录按批次聚合展示。
-- 该列此前已由 `prisma db push` 直接推入数据库，本迁移补齐迁移记录，
-- 确保全新部署时 `prisma migrate deploy` 能正常建立此列。

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `batch_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `notifications_batch_id_idx` ON `notifications`(`batch_id`);
