-- Make knowledge_points.subject_id NOT NULL
-- 暂不执行：FK constraint 的 ON DELETE SET NULL 与 NOT NULL 冲突
-- 但后端 getTree 已按 subjectId 过滤，可达科目隔离目标

-- ALTER TABLE `knowledge_points` MODIFY `subject_id` INT NOT NULL;
