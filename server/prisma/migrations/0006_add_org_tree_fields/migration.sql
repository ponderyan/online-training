-- Add organization tree fields: parentId / level / path / sortOrder
-- Allows multi-level org hierarchy (总会 → 分会 → 部门 → 机构)

ALTER TABLE `organizations` ADD COLUMN `parent_id` INTEGER NULL;
ALTER TABLE `organizations` ADD COLUMN `level` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `organizations` ADD COLUMN `path` VARCHAR(500) NULL;
ALTER TABLE `organizations` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing flat orgs are level 1, path = /<id>/
UPDATE `organizations` SET `level` = 1, `path` = CONCAT('/', `id`, '/') WHERE `path` IS NULL;

-- Self-referential FK for parent (Restrict delete to protect children)
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_parent_id_fkey`
  FOREIGN KEY (`parent_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index for tree lookups by parent
CREATE INDEX `organizations_parent_id_idx` ON `organizations`(`parent_id`);
