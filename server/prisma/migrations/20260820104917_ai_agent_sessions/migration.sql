-- AlterTable
ALTER TABLE `knowledge_chunks` ADD COLUMN `embedding` JSON NULL;

-- CreateTable
CREATE TABLE `ai_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_sessions_userId_updated_at_idx`(`userId`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_session_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `seq` INTEGER NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `role` VARCHAR(20) NULL,
    `content` TEXT NULL,
    `toolCallId` VARCHAR(100) NULL,
    `toolName` VARCHAR(100) NULL,
    `tool_arguments` JSON NULL,
    `tool_result` JSON NULL,
    `source_event_seqs` JSON NULL,
    `surface_op` VARCHAR(10) NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_session_events_sessionId_seq_idx`(`sessionId`, `seq`),
    UNIQUE INDEX `ai_session_events_sessionId_seq_key`(`sessionId`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_sessions` ADD CONSTRAINT `ai_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_session_events` ADD CONSTRAINT `ai_session_events_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ai_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
