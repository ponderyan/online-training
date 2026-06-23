/**
 * 数据迁移脚本：CourseVideo → VideoCourse
 *
 * 执行：npx ts-node scripts/migrate-course-video.ts
 * 安全：三步验证确认数据完整后，再删旧表
 *
 * 迁移逻辑：
 * 1. 读取所有旧 CourseVideo
 * 2. 创建新 VideoCourse（type=SPECIALIZED）
 * 3. 建立 VideoCourseCourse 关联
 * 4. 更新 VideoProgress.videoId 指向新 ID
 * 5. 验证数据完整性
 * 6. 标记旧表可删除
 *
 * 安全设计：
 * - 先校验再删除
 * - 打印详细迁移报告
 * - 支持回滚（旧数据保留到确认删除前）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 开始迁移 CourseVideo → VideoCourse ===\n');

  // ── 1. 读取旧数据 ──
  const oldVideos = await prisma.courseVideo.findMany();
  console.log(`找到 ${oldVideos.length} 条旧 CourseVideo 记录`);

  if (oldVideos.length === 0) {
    console.log('无需迁移，旧表为空。');
    await cleanup();
    return;
  }

  // ── 2. 迁移数据 ──
  let migrated = 0;
  let errors = 0;
  const idMap = new Map<number, number>(); // oldId → newId

  for (const old of oldVideos) {
    try {
      const newVideo = await prisma.videoCourse.create({
        data: {
          name: old.title,
          url: old.url,
          duration: old.duration,
          type: 'SPECIALIZED', // 旧数据都有 courseId
          isContinuingEducation: false,
          sortOrder: old.sortOrder,
          courseLinks: {
            create: { courseId: old.courseId },
          },
        },
      });
      idMap.set(old.id, newVideo.id);
      migrated++;
    } catch (e) {
      console.error(`  迁移失败: id=${old.id} title=${old.title}`, (e as Error).message);
      errors++;
    }
  }

  console.log(`\n迁移完成：成功 ${migrated}，失败 ${errors}`);

  // ── 3. 更新 VideoProgress ──
  let progressUpdated = 0;
  let progressErrors = 0;

  for (const [oldId, newId] of idMap) {
    try {
      const result = await prisma.videoProgress.updateMany({
        where: { videoId: oldId },
        data: { videoId: newId },
      });
      progressUpdated += result.count;
    } catch (e) {
      console.error(`  进度更新失败: oldVideoId=${oldId}`, (e as Error).message);
      progressErrors++;
    }
  }

  console.log(`进度迁移：更新 ${progressUpdated} 条进度记录，失败 ${progressErrors}`);

  // ── 4. 数据完整性校验 ──
  console.log('\n=== 数据校验 ===');

  const newCount = await prisma.videoCourse.count();
  const linkCount = await prisma.videoCourseCourse.count();

  console.log(`新表 VideoCourse: ${newCount} 条`);
  console.log(`关联表 VideoCourseCourse: ${linkCount} 条`);

  if (newCount === migrated && errors === 0) {
    console.log('\n✅ 数据校验通过！所有旧记录已成功迁移。');
  } else {
    console.log(`\n⚠️  数据校验不完整：预期 ${oldVideos.length}，实际 VideoCourse ${newCount}`);
    process.exit(1);
  }

  // ── 5. 检查 VideoProgress 完整性 ──
  const orphaned = await prisma.videoProgress.findFirst({
    where: { videoId: { notIn: Array.from(idMap.values()) } },
  });
  if (orphaned) {
    console.log('⚠️  存在孤立 VideoProgress 记录（videoId 不指向任何 VideoCourse）');
  } else {
    console.log('✅ VideoProgress 全部指向有效 VideoCourse');
  }

  // ── 6. 完成 ──
  console.log('\n=== 迁移完成 ===');
  console.log('旧 CourseVideo 表仍保留，确认数据无误后可执行下一步清理。');
  console.log('运行 prisma db push 或手动 DROP TABLE course_videos 移除旧表。');
}

async function cleanup() {
  console.log('\n执行清理检查…');
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('迁移失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
