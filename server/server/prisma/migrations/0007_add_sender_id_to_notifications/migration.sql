-- Add senderId to Notification model
ALTER TABLE `notifications` ADD COLUMN `sender_id` INT NULL AFTER `user_id`;
CREATE INDEX `notifications_sender_id_idx` ON `notifications`(`sender_id`);
CREATE INDEX `notifications_sender_id_created_at_idx` ON `notifications`(`sender_id`, `created_at`);
