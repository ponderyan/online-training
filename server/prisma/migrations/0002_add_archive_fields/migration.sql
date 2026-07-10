-- Add archive fields for material soft-delete
ALTER TABLE `materials` ADD COLUMN `archived_at` DATETIME(3) NULL AFTER `updated_at`;

-- Add source note for question tracking
ALTER TABLE `questions` ADD COLUMN `source_note` VARCHAR(300) NULL AFTER `practice_visible`;
