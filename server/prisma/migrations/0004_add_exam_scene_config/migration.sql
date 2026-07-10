-- Add exam scene configuration fields (Part 4)
ALTER TABLE `exams` ADD COLUMN `time_mode` VARCHAR(20) NOT NULL DEFAULT 'FIXED' AFTER `shuffle_options`;
ALTER TABLE `exams` ADD COLUMN `paper_mode` VARCHAR(20) NOT NULL DEFAULT 'SAME' AFTER `time_mode`;
ALTER TABLE `exams` ADD COLUMN `tab_switch_limit` INT NOT NULL DEFAULT 5 AFTER `paper_mode`;
ALTER TABLE `exams` ADD COLUMN `copy_protection` TINYINT NOT NULL DEFAULT 1 AFTER `tab_switch_limit`;
ALTER TABLE `exams` ADD COLUMN `auto_save_interval` INT NOT NULL DEFAULT 30 AFTER `copy_protection`;

-- Note: the above columns may already exist if db push was run
