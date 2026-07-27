-- CreateTable
CREATE TABLE `organizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `contact_name` VARCHAR(100) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `contact_email` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `parent_id` INTEGER NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `path` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `seal_url` VARCHAR(500) NULL,
    `seal_hash` VARCHAR(64) NULL,
    `use_foxlearn_seal` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `organizations_code_key`(`code`),
    INDEX `organizations_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `program_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `program_id` INTEGER NOT NULL,
    `head_teacher_id` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `description` TEXT NULL,
    `note` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `program_batches_program_id_idx`(`program_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `avatar` VARCHAR(500) NULL,
    `org_id` INTEGER NULL,
    `batch_id` INTEGER NULL,
    `student_number` VARCHAR(50) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `organization` VARCHAR(200) NULL,
    `title` VARCHAR(100) NULL,
    `gender` VARCHAR(10) NULL,
    `id_card` VARCHAR(18) NULL,
    `source` VARCHAR(50) NULL,
    `remark` TEXT NULL,
    `education` VARCHAR(20) NULL,
    `education_school` VARCHAR(200) NULL,
    `major` VARCHAR(200) NULL,
    `graduation_date` DATETIME(3) NULL,
    `professional_title` VARCHAR(100) NULL,
    `professional_level` VARCHAR(20) NULL,
    `fee_status` VARCHAR(20) NULL DEFAULT 'UNPAID',
    `enrolled_at` DATETIME(3) NULL,
    `graduated_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `login_count` INTEGER NOT NULL DEFAULT 0,
    `tags` JSON NULL,
    `primary_agency_id` INTEGER NULL,
    `mailing_address` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_student_number_key`(`student_number`),
    UNIQUE INDEX `users_id_card_key`(`id_card`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_role_assignments_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_by` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attachments_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `exam_id` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `method` VARCHAR(191) NULL,
    `invoice_no` VARCHAR(100) NULL,
    `note` TEXT NULL,
    `operator_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_records_student_id_idx`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `operator_id` INTEGER NULL,
    `operator_name` VARCHAR(100) NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_dictionaries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `data_dictionaries_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `dictionary_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `paper_number_seq` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chapters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NULL,
    `type` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission` VARCHAR(100) NOT NULL,
    `isGranted` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_permissions_role_id_permission_key`(`role_id`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_tags` (
    `question_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`question_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject_id` INTEGER NOT NULL,
    `chapter_id` INTEGER NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY') NOT NULL,
    `content` TEXT NOT NULL,
    `analysis` TEXT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD') NOT NULL,
    `source` ENUM('MANUAL', 'AI_IMPORT', 'BATCH_IMPORT') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `practice_visible` BOOLEAN NOT NULL DEFAULT false,
    `source_note` VARCHAR(300) NULL,
    `created_by` INTEGER NULL,
    `org_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_points` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `subject_id` INTEGER NULL,
    `parent_id` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `knowledge_points_code_key`(`code`),
    INDEX `knowledge_points_parent_id_idx`(`parent_id`),
    INDEX `knowledge_points_subject_id_idx`(`subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_knowledge_points` (
    `question_id` INTEGER NOT NULL,
    `knowledge_point_id` INTEGER NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,

    PRIMARY KEY (`question_id`, `knowledge_point_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `label` VARCHAR(10) NOT NULL,
    `content` TEXT NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_blanks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `blank_index` INTEGER NOT NULL,
    `answer` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_sub_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `answer` TEXT NULL,
    `score` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `total_score` INTEGER NOT NULL,
    `duration_minutes` INTEGER NOT NULL DEFAULT 90,
    `is_open_book` BOOLEAN NOT NULL DEFAULT false,
    `difficulty_distribution` JSON NOT NULL,
    `chapter_strategy` ENUM('EVEN', 'WEIGHTED', 'RANDOM') NOT NULL DEFAULT 'EVEN',
    `source_mix` INTEGER NOT NULL DEFAULT 80,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_template_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` INTEGER NOT NULL,
    `question_type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY') NOT NULL,
    `count` INTEGER NOT NULL,
    `score_per_question` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `papers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `paper_number` VARCHAR(50) NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `template_id` INTEGER NULL,
    `total_score` INTEGER NOT NULL,
    `duration_minutes` INTEGER NOT NULL DEFAULT 90,
    `is_open_book` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'FINALIZED', 'OFFICIAL') NOT NULL DEFAULT 'DRAFT',
    `created_by` INTEGER NOT NULL,
    `org_id` INTEGER NULL,
    `finalized_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `proposition_by_id` INTEGER NULL,

    UNIQUE INDEX `papers_paper_number_key`(`paper_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paper_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `type_section` VARCHAR(191) NULL,
    `snapshot` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cool_down_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `paper_id` INTEGER NULL,
    `used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `api_base_url` VARCHAR(500) NOT NULL,
    `api_key` VARCHAR(500) NOT NULL,
    `model_version` VARCHAR(100) NOT NULL,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `top_p` DOUBLE NOT NULL DEFAULT 0.9,
    `max_tokens` INTEGER NOT NULL DEFAULT 4096,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_chunks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject_id` INTEGER NOT NULL,
    `chapter_id` INTEGER NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` TEXT NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `source` VARCHAR(200) NULL,
    `token_count` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `file_name` VARCHAR(500) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(20) NULL,
    `subject_id` INTEGER NOT NULL,
    `batch_note` TEXT NULL,
    `total_pages` INTEGER NULL,
    `status` ENUM('UPLOADED', 'PROCESSING', 'OCR_DONE', 'STRUCTURED', 'GENERATING', 'GENERATED', 'REVIEWING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
    `error_message` TEXT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `archived_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_chapters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `chapter_index` INTEGER NOT NULL,
    `content` MEDIUMTEXT NULL,
    `content_length` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `status` ENUM('PENDING', 'STRUCTURED', 'GENERATING', 'GENERATED') NOT NULL DEFAULT 'PENDING',
    `question_count` INTEGER NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_question_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_question_plan_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `chapter_id` INTEGER NULL,
    `type` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `difficulty_easy` INTEGER NULL DEFAULT 30,
    `difficulty_medium` INTEGER NULL DEFAULT 50,
    `difficulty_hard` INTEGER NULL DEFAULT 20,
    `focus_keywords` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER NOT NULL,
    `chapter_id` INTEGER NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY') NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD') NOT NULL,
    `knowledge_point` VARCHAR(200) NULL,
    `source_chunk` VARCHAR(200) NULL,
    `content` TEXT NOT NULL,
    `options` JSON NULL,
    `blanks` JSON NULL,
    `answer` TEXT NULL,
    `explanation` TEXT NULL,
    `suggested_group` VARCHAR(191) NULL DEFAULT 'EXAM_GROUP',
    `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EDITED') NOT NULL DEFAULT 'PENDING',
    `review_note` TEXT NULL,
    `question_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `sender_id` INTEGER NULL,
    `type` ENUM('EXAM_PUBLISHED', 'EXAM_CONFIRMED', 'EXAM_GRADED', 'EXAM_STARTING', 'APPEAL_SUBMITTED', 'APPEAL_RESOLVED', 'GRADING_ASSIGNED', 'LEARNING_HOUR_SUBMITTED', 'LEARNING_HOUR_APPROVED', 'LEARNING_HOUR_REJECTED', 'CERT_ISSUED', 'CERT_APPROVED', 'CERT_REJECTED', 'CERT_APPLICATION', 'CERT_EXPIRING', 'PROGRAM_ENROLLED', 'PROGRAM_STATUS', 'ACCOUNT_CREATED', 'SYSTEM_NOTICE', 'ANNOUNCEMENT') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `reference_id` INTEGER NULL,
    `reference_type` VARCHAR(191) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,

    INDEX `notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    INDEX `notifications_created_at_idx`(`created_at`),
    INDEX `notifications_sender_id_idx`(`sender_id`),
    INDEX `notifications_sender_id_created_at_idx`(`sender_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `notification_id` INTEGER NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_channels_notification_id_idx`(`notification_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `paper_id` INTEGER NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `access_type` ENUM('UNIFIED', 'FLEXIBLE') NOT NULL DEFAULT 'UNIFIED',
    `max_attempts` INTEGER NOT NULL DEFAULT 1,
    `password` VARCHAR(50) NULL,
    `program_id` INTEGER NULL,
    `is_open_book` BOOLEAN NOT NULL DEFAULT false,
    `open_book_rules` TEXT NULL,
    `late_entry_minutes` INTEGER NULL,
    `early_exit_minutes` INTEGER NULL,
    `shuffle_questions` BOOLEAN NOT NULL DEFAULT true,
    `shuffle_options` BOOLEAN NOT NULL DEFAULT true,
    `time_mode` ENUM('FIXED', 'FLEXIBLE') NOT NULL DEFAULT 'FIXED',
    `paper_mode` ENUM('SAME', 'RANDOM') NOT NULL DEFAULT 'SAME',
    `tab_switch_limit` INTEGER NOT NULL DEFAULT 5,
    `copy_protection` BOOLEAN NOT NULL DEFAULT true,
    `auto_save_interval` INTEGER NOT NULL DEFAULT 30,
    `status` ENUM('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `total_students` INTEGER NOT NULL DEFAULT 0,
    `submitted_count` INTEGER NOT NULL DEFAULT 0,
    `passing_score` DOUBLE NULL,
    `max_retake_attempts` INTEGER NULL,
    `retake_window_days` INTEGER NULL,
    `scoring_mode` VARCHAR(191) NOT NULL DEFAULT 'MIXED',
    `score_publish_mode` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `publish_at` DATETIME(3) NULL,
    `appeal_deadline_hours` INTEGER NULL DEFAULT 72,
    `show_answer_after_exam` BOOLEAN NOT NULL DEFAULT false,
    `created_by` INTEGER NOT NULL,
    `org_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `instructor_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
    `started_at` DATETIME(3) NULL,
    `submitted_at` DATETIME(3) NULL,
    `remaining_time` INTEGER NULL,
    `suspicion_level` INTEGER NOT NULL DEFAULT 0,
    `violation_log` JSON NULL,
    `last_heartbeat_at` DATETIME(3) NULL,
    `proctor_actions` JSON NULL,
    `total_score` DOUBLE NULL,
    `subjective_score` DOUBLE NULL,
    `final_score` DOUBLE NULL,
    `score_breakdown` JSON NULL,
    `is_passed` BOOLEAN NULL,
    `scoring_status` VARCHAR(191) NULL DEFAULT 'PENDING',
    `scoring_published_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `marked_questions` VARCHAR(191) NOT NULL DEFAULT '[]',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exam_sessions_exam_id_student_id_key`(`exam_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_session_id` INTEGER NOT NULL,
    `messageType` VARCHAR(50) NOT NULL,
    `content` TEXT NOT NULL,
    `senderName` VARCHAR(100) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `paper_question_id` INTEGER NOT NULL,
    `answer` JSON NOT NULL,
    `is_correct` BOOLEAN NULL,
    `score` DOUBLE NULL,
    `grader_note` TEXT NULL,
    `ai_score` DOUBLE NULL,
    `ai_comment` TEXT NULL,
    `ai_score_detail` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exam_answers_session_id_paper_question_id_key`(`session_id`, `paper_question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `score_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `session_id` INTEGER NULL,
    `student_id` INTEGER NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `field_name` VARCHAR(50) NULL,
    `old_value` DOUBLE NULL,
    `new_value` DOUBLE NULL,
    `reason` TEXT NULL,
    `operator_id` INTEGER NOT NULL,
    `operator_name` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `score_audit_logs_exam_id_idx`(`exam_id`),
    INDEX `score_audit_logs_session_id_idx`(`session_id`),
    INDEX `score_audit_logs_student_id_idx`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_session_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `certificateNo` VARCHAR(64) NOT NULL,
    `studentName` VARCHAR(100) NOT NULL,
    `courseName` VARCHAR(200) NOT NULL,
    `issue_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `revoked_at` DATETIME(3) NULL,
    `revoke_reason` TEXT NULL,
    `approval_status` VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `reject_reason` TEXT NULL,
    `verificationCode` VARCHAR(128) NOT NULL,
    `metadata` JSON NULL,
    `program_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `certificates_certificateNo_key`(`certificateNo`),
    UNIQUE INDEX `certificates_verificationCode_key`(`verificationCode`),
    INDEX `certificates_exam_session_id_idx`(`exam_session_id`),
    INDEX `certificates_student_id_idx`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_verification_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `certificate_id` INTEGER NOT NULL,
    `query_type` VARCHAR(191) NOT NULL,
    `queried_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,

    INDEX `certificate_verification_logs_certificate_id_idx`(`certificate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_programs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `course_name` VARCHAR(200) NOT NULL,
    `org_id` INTEGER NULL,
    `course_id` INTEGER NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `enroll_start` DATETIME(3) NOT NULL,
    `enroll_end` DATETIME(3) NOT NULL,
    `tuition_fee` DOUBLE NULL,
    `exam_fee` DOUBLE NULL,
    `cert_fee` DOUBLE NULL,
    `hours_per_day` DOUBLE NULL,
    `subject_id` INTEGER NOT NULL,
    `created_by` INTEGER NOT NULL,
    `status` ENUM('PREPARING', 'ENROLLING', 'IN_PROGRESS', 'REVIEWING', 'CERTIFYING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PREPARING',
    `description` TEXT NULL,
    `location` VARCHAR(200) NULL,
    `max_students` INTEGER NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `training_programs_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_agencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `short_name` VARCHAR(50) NULL,
    `contact_person` VARCHAR(100) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `contact_email` VARCHAR(100) NULL,
    `total_enrolled` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `organization_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `program_enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `agency_id` INTEGER NULL,
    `enroll_source` VARCHAR(50) NULL,
    `enroll_note` TEXT NULL,
    `fee_status` VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    `fee_amount` DOUBLE NULL,
    `paid_at` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `program_enrollments_program_id_idx`(`program_id`),
    INDEX `program_enrollments_student_id_idx`(`student_id`),
    INDEX `program_enrollments_agency_id_idx`(`agency_id`),
    UNIQUE INDEX `program_enrollments_program_id_student_id_key`(`program_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `apply_note` TEXT NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_by` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_note` TEXT NULL,
    `certificate_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `certificate_applications_student_id_idx`(`student_id`),
    INDEX `certificate_applications_status_idx`(`status`),
    UNIQUE INDEX `certificate_applications_session_id_student_id_key`(`session_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_approval_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `certificate_id` INTEGER NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `operator_name` VARCHAR(100) NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `certificate_approval_logs_certificate_id_idx`(`certificate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_hour_certificates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `program_id` INTEGER NULL,
    `student_name` VARCHAR(100) NOT NULL,
    `id_card` VARCHAR(18) NULL,
    `program_name` VARCHAR(200) NULL,
    `org_name` VARCHAR(200) NULL,
    `total_hours` DOUBLE NOT NULL,
    `hours_detail` JSON NOT NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `certificate_no` VARCHAR(100) NOT NULL,
    `verification_code` VARCHAR(64) NOT NULL,
    `content_hash` VARCHAR(64) NULL,
    `seal_url` VARCHAR(500) NULL,
    `seal_hash` VARCHAR(64) NULL,
    `approval_status` VARCHAR(20) NOT NULL DEFAULT 'AUTO_APPROVED',
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,
    `approved_by` INTEGER NULL,
    `review_note` TEXT NULL,
    `org_id` INTEGER NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `revoked_at` DATETIME(3) NULL,
    `revoke_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `learning_hour_certificates_certificate_no_key`(`certificate_no`),
    INDEX `learning_hour_certificates_student_id_idx`(`student_id`),
    INDEX `learning_hour_certificates_program_id_idx`(`program_id`),
    INDEX `learning_hour_certificates_approval_status_idx`(`approval_status`),
    INDEX `learning_hour_certificates_certificate_no_idx`(`certificate_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grading_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `grader_id` INTEGER NOT NULL,
    `paper_question_id` INTEGER NULL,
    `session_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `grading_assignments_exam_id_grader_id_paper_question_id_sess_key`(`exam_id`, `grader_id`, `paper_question_id`, `session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grading_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `session_id` INTEGER NOT NULL,
    `answer_id` INTEGER NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `original_score` DOUBLE NOT NULL,
    `reviewed_score` DOUBLE NULL,
    `reviewer_id` INTEGER NULL,
    `reviewer_note` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `grading_reviews_exam_id_idx`(`exam_id`),
    INDEX `grading_reviews_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instructors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `real_name` VARCHAR(100) NOT NULL,
    `title` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `avatar` VARCHAR(500) NULL,
    `bio` TEXT NULL,
    `expertise` VARCHAR(500) NULL,
    `qualification` VARCHAR(500) NULL,
    `level` VARCHAR(20) NULL DEFAULT 'JUNIOR',
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `is_grader` BOOLEAN NOT NULL DEFAULT true,
    `remark` TEXT NULL,
    `instructor_no` VARCHAR(50) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    `work_unit` VARCHAR(200) NULL,
    `education` VARCHAR(20) NULL,
    `school` VARCHAR(200) NULL,
    `gender` VARCHAR(10) NULL,
    `id_card` VARCHAR(18) NULL,
    `bank_account` VARCHAR(50) NULL,
    `contract_expire` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instructors_user_id_key`(`user_id`),
    UNIQUE INDEX `instructors_instructor_no_key`(`instructor_no`),
    UNIQUE INDEX `instructors_id_card_key`(`id_card`),
    INDEX `instructors_user_id_idx`(`user_id`),
    INDEX `instructors_status_idx`(`status`),
    INDEX `instructors_type_idx`(`type`),
    INDEX `instructors_work_unit_idx`(`work_unit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `hours` DOUBLE NULL,
    `syllabus` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `remark` TEXT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    `parent_course_id` INTEGER NULL,
    `is_reviewed` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `courses_code_key`(`code`),
    INDEX `courses_status_idx`(`status`),
    INDEX `courses_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_knowledge_points` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `knowledge_point_id` INTEGER NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `course_knowledge_points_course_id_knowledge_point_id_key`(`course_id`, `knowledge_point_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_videos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `requiredPct` DOUBLE NOT NULL DEFAULT 80,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `course_videos_course_id_idx`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_progresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `video_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `progress` DOUBLE NOT NULL DEFAULT 0,
    `last_position` INTEGER NOT NULL DEFAULT 0,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `video_progresses_video_id_student_id_key`(`video_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `instructorName` VARCHAR(100) NULL,
    `instructorLevel` VARCHAR(50) NULL,
    `instructor_id` INTEGER NULL,
    `hours` DOUBLE NULL,
    `url` VARCHAR(500) NULL,
    `original_file_name` VARCHAR(500) NULL,
    `cover_url` VARCHAR(500) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `type` VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    `is_continuing_education` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `video_courses_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_course_courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `video_course_id` INTEGER NOT NULL,
    `course_id` INTEGER NOT NULL,
    `feature` VARCHAR(50) NULL,

    UNIQUE INDEX `video_course_courses_video_course_id_course_id_key`(`video_course_id`, `course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_course_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `video_course_id` INTEGER NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `operator_id` INTEGER NULL,
    `detail` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `video_course_logs_video_course_id_idx`(`video_course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_hour_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `description` VARCHAR(200) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `learning_hour_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_hour_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `program_id` INTEGER NULL,
    `source` VARCHAR(20) NOT NULL,
    `source_id` INTEGER NULL,
    `hours` DOUBLE NOT NULL,
    `type_id` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `approved_by_id` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `review_comment` TEXT NULL,
    `note` TEXT NULL,
    `description` TEXT NULL,
    `submitted_by_id` INTEGER NULL,
    `evidence_url` VARCHAR(500) NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `learning_hour_records_student_id_program_id_idx`(`student_id`, `program_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `course_id` INTEGER NOT NULL,
    `instructor_id` INTEGER NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `location` VARCHAR(200) NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `schedules_program_id_idx`(`program_id`),
    INDEX `schedules_course_id_idx`(`course_id`),
    INDEX `schedules_instructor_id_idx`(`instructor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoreAppeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `session_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `oldScore` DOUBLE NULL,
    `newScore` DOUBLE NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `reviewer_id` INTEGER NULL,
    `reviewNote` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScoreAppeal_session_id_key`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `is_anonymous` BOOLEAN NOT NULL DEFAULT false,
    `content_rating` INTEGER NOT NULL,
    `instructor_rating` INTEGER NOT NULL,
    `organization_rating` INTEGER NULL,
    `overall_rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `instructor_id` INTEGER NULL,
    `course_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `evaluations_program_id_student_id_key`(`program_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_instructor_ratings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evaluation_id` INTEGER NOT NULL,
    `instructor_id` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,

    INDEX `evaluation_instructor_ratings_instructor_id_idx`(`instructor_id`),
    UNIQUE INDEX `evaluation_instructor_ratings_evaluation_id_instructor_id_key`(`evaluation_id`, `instructor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteName` VARCHAR(100) NOT NULL DEFAULT 'FoxLearn',
    `siteTitle` VARCHAR(200) NOT NULL DEFAULT 'FoxLearn · 狐学',
    `siteLogo` VARCHAR(500) NULL,
    `favicon` VARCHAR(500) NULL,
    `footerText` TEXT NULL,
    `icpBeian` VARCHAR(100) NULL,
    `publicRegistration` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` VARCHAR(2000) NOT NULL,
    `desc` VARCHAR(500) NULL,
    `group` VARCHAR(50) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'text',
    `options` VARCHAR(500) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `module` VARCHAR(50) NOT NULL,
    `fileName` VARCHAR(500) NOT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `successRows` INTEGER NOT NULL DEFAULT 0,
    `failRows` INTEGER NOT NULL DEFAULT 0,
    `errors` JSON NULL,
    `operator_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `module` VARCHAR(50) NOT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `operator_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `program_status_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `from_status` ENUM('PREPARING', 'ENROLLING', 'IN_PROGRESS', 'REVIEWING', 'CERTIFYING', 'COMPLETED', 'CANCELLED') NULL,
    `to_status` ENUM('PREPARING', 'ENROLLING', 'IN_PROGRESS', 'REVIEWING', 'CERTIFYING', 'COMPLETED', 'CANCELLED') NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_evidences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `evidenceType` VARCHAR(50) NOT NULL,
    `fileName` VARCHAR(500) NOT NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `fileType` VARCHAR(100) NOT NULL,
    `uploaded_by_id` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `total_days` INTEGER NOT NULL DEFAULT 0,
    `actual_days` INTEGER NOT NULL DEFAULT 0,
    `attendance_rate` DOUBLE NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    `modified_by_id` INTEGER NULL,
    `modified_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_records_program_id_student_id_key`(`program_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_agency_enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER NOT NULL,
    `agencyName` VARCHAR(200) NOT NULL,
    `agencyContact` VARCHAR(100) NOT NULL,
    `agencyPhone` VARCHAR(20) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submitted_by_id` INTEGER NOT NULL,
    `reviewed_by_id` INTEGER NULL,
    `reviewComment` TEXT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_traces` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `certificate_id` INTEGER NOT NULL,
    `snapshot_data` JSON NOT NULL,
    `traceType` VARCHAR(20) NOT NULL DEFAULT 'ISSUE',
    `operator_id` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_favorites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `question_favorites_student_id_idx`(`student_id`),
    UNIQUE INDEX `question_favorites_student_id_question_id_key`(`student_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practice_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `answer` JSON NOT NULL,
    `is_correct` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `practice_records_student_id_is_correct_idx`(`student_id`, `is_correct`),
    UNIQUE INDEX `practice_records_student_id_question_id_key`(`student_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_batches` ADD CONSTRAINT `program_batches_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_batches` ADD CONSTRAINT `program_batches_head_teacher_id_fkey` FOREIGN KEY (`head_teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `program_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_primary_agency_id_fkey` FOREIGN KEY (`primary_agency_id`) REFERENCES `enrollment_agencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_records` ADD CONSTRAINT `fee_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_dictionary_id_fkey` FOREIGN KEY (`dictionary_id`) REFERENCES `data_dictionaries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_tags` ADD CONSTRAINT `question_tags_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_tags` ADD CONSTRAINT `question_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_points` ADD CONSTRAINT `knowledge_points_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_points` ADD CONSTRAINT `knowledge_points_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `knowledge_points`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_knowledge_points` ADD CONSTRAINT `question_knowledge_points_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_knowledge_points` ADD CONSTRAINT `question_knowledge_points_knowledge_point_id_fkey` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_blanks` ADD CONSTRAINT `question_blanks_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_sub_questions` ADD CONSTRAINT `question_sub_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_templates` ADD CONSTRAINT `paper_templates_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_templates` ADD CONSTRAINT `paper_templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_template_types` ADD CONSTRAINT `paper_template_types_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `paper_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `paper_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_proposition_by_id_fkey` FOREIGN KEY (`proposition_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_questions` ADD CONSTRAINT `paper_questions_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_questions` ADD CONSTRAINT `paper_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cool_down_records` ADD CONSTRAINT `cool_down_records_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cool_down_records` ADD CONSTRAINT `cool_down_records_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_configs` ADD CONSTRAINT `ai_configs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_chapters` ADD CONSTRAINT `material_chapters_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_question_plans` ADD CONSTRAINT `material_question_plans_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_question_plan_configs` ADD CONSTRAINT `material_question_plan_configs_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `material_question_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_question_plan_configs` ADD CONSTRAINT `material_question_plan_configs_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `material_chapters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_questions` ADD CONSTRAINT `material_questions_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_questions` ADD CONSTRAINT `material_questions_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `material_chapters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_questions` ADD CONSTRAINT `material_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_channels` ADD CONSTRAINT `notification_channels_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_sessions` ADD CONSTRAINT `exam_sessions_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_sessions` ADD CONSTRAINT `exam_sessions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_messages` ADD CONSTRAINT `exam_messages_exam_session_id_fkey` FOREIGN KEY (`exam_session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_answers` ADD CONSTRAINT `exam_answers_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_programs` ADD CONSTRAINT `training_programs_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_programs` ADD CONSTRAINT `training_programs_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_agencies` ADD CONSTRAINT `enrollment_agencies_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_enrollments` ADD CONSTRAINT `program_enrollments_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_enrollments` ADD CONSTRAINT `program_enrollments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_enrollments` ADD CONSTRAINT `program_enrollments_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `enrollment_agencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_applications` ADD CONSTRAINT `certificate_applications_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_assignments` ADD CONSTRAINT `grading_assignments_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_assignments` ADD CONSTRAINT `grading_assignments_grader_id_fkey` FOREIGN KEY (`grader_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_assignments` ADD CONSTRAINT `grading_assignments_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_reviews` ADD CONSTRAINT `grading_reviews_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_reviews` ADD CONSTRAINT `grading_reviews_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_reviews` ADD CONSTRAINT `grading_reviews_answer_id_fkey` FOREIGN KEY (`answer_id`) REFERENCES `exam_answers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_reviews` ADD CONSTRAINT `grading_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instructors` ADD CONSTRAINT `instructors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_parent_course_id_fkey` FOREIGN KEY (`parent_course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_knowledge_points` ADD CONSTRAINT `course_knowledge_points_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_knowledge_points` ADD CONSTRAINT `course_knowledge_points_knowledge_point_id_fkey` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_videos` ADD CONSTRAINT `course_videos_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_progresses` ADD CONSTRAINT `video_progresses_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `video_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_progresses` ADD CONSTRAINT `video_progresses_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_course_courses` ADD CONSTRAINT `video_course_courses_video_course_id_fkey` FOREIGN KEY (`video_course_id`) REFERENCES `video_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_course_courses` ADD CONSTRAINT `video_course_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_course_logs` ADD CONSTRAINT `video_course_logs_video_course_id_fkey` FOREIGN KEY (`video_course_id`) REFERENCES `video_courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_course_logs` ADD CONSTRAINT `video_course_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_hour_records` ADD CONSTRAINT `learning_hour_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_hour_records` ADD CONSTRAINT `learning_hour_records_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_hour_records` ADD CONSTRAINT `learning_hour_records_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `learning_hour_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_hour_records` ADD CONSTRAINT `learning_hour_records_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreAppeal` ADD CONSTRAINT `ScoreAppeal_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreAppeal` ADD CONSTRAINT `ScoreAppeal_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `exam_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreAppeal` ADD CONSTRAINT `ScoreAppeal_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreAppeal` ADD CONSTRAINT `ScoreAppeal_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_instructor_ratings` ADD CONSTRAINT `evaluation_instructor_ratings_evaluation_id_fkey` FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_instructor_ratings` ADD CONSTRAINT `evaluation_instructor_ratings_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_logs` ADD CONSTRAINT `import_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_logs` ADD CONSTRAINT `export_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_status_logs` ADD CONSTRAINT `program_status_logs_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_status_logs` ADD CONSTRAINT `program_status_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_evidences` ADD CONSTRAINT `business_evidences_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_evidences` ADD CONSTRAINT `business_evidences_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_modified_by_id_fkey` FOREIGN KEY (`modified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_agency_enrollments` ADD CONSTRAINT `enrollment_agency_enrollments_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_agency_enrollments` ADD CONSTRAINT `enrollment_agency_enrollments_submitted_by_id_fkey` FOREIGN KEY (`submitted_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_agency_enrollments` ADD CONSTRAINT `enrollment_agency_enrollments_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_traces` ADD CONSTRAINT `certificate_traces_certificate_id_fkey` FOREIGN KEY (`certificate_id`) REFERENCES `certificates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_traces` ADD CONSTRAINT `certificate_traces_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_favorites` ADD CONSTRAINT `question_favorites_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_favorites` ADD CONSTRAINT `question_favorites_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_records` ADD CONSTRAINT `practice_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_records` ADD CONSTRAINT `practice_records_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
