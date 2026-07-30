-- FoxLearn 初始化（Docker 首次启动时执行）
-- Prisma migrate deploy 会自动建表，这里只做基础配置
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
ALTER DATABASE online_training CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
