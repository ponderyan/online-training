-- AlterTable
ALTER TABLE `learning_hour_certificates` ADD COLUMN `template_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `learning_hour_certificates_template_id_idx` ON `learning_hour_certificates`(`template_id`);

-- AddForeignKey
ALTER TABLE `learning_hour_certificates` ADD CONSTRAINT `learning_hour_certificates_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
