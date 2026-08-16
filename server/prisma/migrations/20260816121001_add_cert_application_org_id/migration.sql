-- AlterTable
ALTER TABLE `certificate_applications` ADD COLUMN `org_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `certificate_applications_org_id_idx` ON `certificate_applications`(`org_id`);
