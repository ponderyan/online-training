-- AlterTable
ALTER TABLE `knowledge_chunks` ADD COLUMN `material_chapter_id` INTEGER NULL,
    ADD COLUMN `material_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `knowledge_chunks_material_id_idx` ON `knowledge_chunks`(`material_id`);

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_material_chapter_id_fkey` FOREIGN KEY (`material_chapter_id`) REFERENCES `material_chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
