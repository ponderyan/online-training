-- AlterTable
ALTER TABLE `material_question_plans` ADD COLUMN `generated_count` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `material_questions` ADD COLUMN `plan_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `material_questions` ADD CONSTRAINT `material_questions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `material_question_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
