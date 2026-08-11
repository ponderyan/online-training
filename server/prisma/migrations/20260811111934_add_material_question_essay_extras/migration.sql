-- AlterTable
ALTER TABLE `material_questions` ADD COLUMN `min_answer_words` INTEGER NULL,
    ADD COLUMN `rubric` JSON NULL;
