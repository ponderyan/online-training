-- Create exam_messages table for proctor-student messaging
CREATE TABLE IF NOT EXISTS `exam_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_session_id` INTEGER NOT NULL,
    `messageType` VARCHAR(50) NOT NULL,
    `content` TEXT NOT NULL,
    `senderName` VARCHAR(100) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exam_messages` ADD CONSTRAINT `exam_messages_exam_session_id_fkey` FOREIGN KEY (`exam_session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
