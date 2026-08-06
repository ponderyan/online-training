-- DropForeignKey
ALTER TABLE `subjects` DROP FOREIGN KEY `subjects_dictionary_id_fkey`;

-- DropIndex
DROP INDEX `subjects_dictionary_id_fkey` ON `subjects`;

-- AlterTable
ALTER TABLE `certificate_templates` ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 2,
    MODIFY `thumbnail` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `certificates` ADD COLUMN `issuer_name` VARCHAR(200) NULL,
    ADD COLUMN `org_id` INTEGER NULL,
    ADD COLUMN `template_id` INTEGER NULL,
    MODIFY `approval_status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE `exam_sessions` ADD COLUMN `absent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `attempt_no` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `is_retake` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `original_session_id` INTEGER NULL,
    ADD COLUMN `seat_number` INTEGER NULL;

-- AlterTable
ALTER TABLE `exams` ADD COLUMN `exam_mode` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    ADD COLUMN `locations` JSON NULL,
    ADD COLUMN `original_exam_id` INTEGER NULL,
    ADD COLUMN `seat_layout` JSON NULL,
    MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'AWAITING_GRADING', 'GRADING_IN_PROGRESS', 'SCORE_CONFIRMED', 'SCORE_PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `knowledge_chunks` ADD COLUMN `document_id` INTEGER NULL,
    ADD COLUMN `qa_pairs` JSON NULL;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `cert_footer_text` VARCHAR(500) NULL,
    ADD COLUMN `cert_issuer_name` VARCHAR(200) NULL,
    ADD COLUMN `cert_logo_url` VARCHAR(500) NULL,
    ADD COLUMN `org_type` VARCHAR(20) NOT NULL DEFAULT 'ASSOCIATION';

-- AlterTable
ALTER TABLE `paper_questions` ADD COLUMN `rubric` JSON NULL;

-- AlterTable
ALTER TABLE `papers` MODIFY `status` ENUM('DRAFT', 'PENDING_REVIEW', 'FINALIZED', 'OFFICIAL', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `practice_records` ADD COLUMN `is_subjective` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `subjects` ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `org_id` INTEGER NULL,
    MODIFY `dictionary_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `preferences` TEXT NULL;

-- AlterTable
ALTER TABLE `video_courses` ADD COLUMN `required_pct` DOUBLE NOT NULL DEFAULT 80;

-- CreateTable
CREATE TABLE `video_quizzes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `video_course_id` INTEGER NOT NULL,
    `time_point` INTEGER NOT NULL,
    `question` TEXT NOT NULL,
    `options` TEXT NOT NULL,
    `correct_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_quizzes_video_course_id_idx`(`video_course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offline_score_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `session_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `score_by_type` JSON NOT NULL,
    `total_score` DOUBLE NOT NULL,
    `entered_by` INTEGER NOT NULL,
    `entered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `grader_name` VARCHAR(100) NULL,
    `grader_id` INTEGER NULL,
    `graded_at` DATETIME(3) NULL,
    `reviewer_name` VARCHAR(100) NULL,
    `reviewer_id` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_note` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offline_score_entries_session_id_key`(`session_id`),
    INDEX `offline_score_entries_exam_id_status_idx`(`exam_id`, `status`),
    UNIQUE INDEX `offline_score_entries_exam_id_student_id_key`(`exam_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `file_name` VARCHAR(500) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `fileType` VARCHAR(20) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `chunk_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    `version` INTEGER NOT NULL DEFAULT 1,
    `previous_version_id` INTEGER NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `knowledge_documents_subject_id_idx`(`subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chunk_knowledge_points` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chunk_id` INTEGER NOT NULL,
    `knowledge_point_id` INTEGER NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 1.0,
    `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',

    UNIQUE INDEX `chunk_knowledge_points_chunk_id_knowledge_point_id_key`(`chunk_id`, `knowledge_point_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `org_abbreviation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(50) NOT NULL,
    `abbr` VARCHAR(20) NOT NULL,
    `category` VARCHAR(50) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `org_abbreviation_keyword_key`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `certificates_template_id_idx` ON `certificates`(`template_id`);

-- CreateIndex
CREATE INDEX `knowledge_chunks_document_id_idx` ON `knowledge_chunks`(`document_id`);

-- CreateIndex
CREATE UNIQUE INDEX `subjects_code_key` ON `subjects`(`code`);

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_dictionary_id_fkey` FOREIGN KEY (`dictionary_id`) REFERENCES `data_dictionaries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_programs` ADD CONSTRAINT `training_programs_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_quizzes` ADD CONSTRAINT `video_quizzes_video_course_id_fkey` FOREIGN KEY (`video_course_id`) REFERENCES `video_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_score_entries` ADD CONSTRAINT `offline_score_entries_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_score_entries` ADD CONSTRAINT `offline_score_entries_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_score_entries` ADD CONSTRAINT `offline_score_entries_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offline_score_entries` ADD CONSTRAINT `offline_score_entries_entered_by_fkey` FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chunk_knowledge_points` ADD CONSTRAINT `chunk_knowledge_points_chunk_id_fkey` FOREIGN KEY (`chunk_id`) REFERENCES `knowledge_chunks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chunk_knowledge_points` ADD CONSTRAINT `chunk_knowledge_points_knowledge_point_id_fkey` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

