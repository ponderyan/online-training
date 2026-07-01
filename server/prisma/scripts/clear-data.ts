import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取数据库中所有实际存在的表名
 */
async function getExistingTables(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  return new Set(rows.map((r) => r.TABLE_NAME));
}

/**
 * 安全删除表——如果表存在则执行 DELETE，否则跳过
 */
async function tryDelete(
  table: string,
  existingTables: Set<string>,
  results: { table: string; count: number }[]
) {
  if (!existingTables.has(table)) {
    console.log(`   ↪ ${table}: 表不存在，跳过`);
    return;
  }
  try {
    const count = await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    results.push({ table, count });
  } catch (e: any) {
    console.log(`   ↪ ${table}: 删除失败 (${e?.meta?.code || e?.message || e}), 跳过`);
  }
}

/**
 * 安全更新——如果表存在则执行
 */
async function tryUpdate(
  sql: string,
  existingTables: Set<string>
): Promise<number> {
  const tableMatch = sql.match(/UPDATE\s+`?(\w+)`?\s/i);
  if (tableMatch && !existingTables.has(tableMatch[1])) {
    console.log(`   ↪ ${tableMatch[1]}: 表不存在，跳过`);
    return 0;
  }
  try {
    return await prisma.$executeRawUnsafe(sql);
  } catch {
    return 0;
  }
}

async function main() {
  console.log('🧹 开始清理业务测试数据...\n');

  const existingTables = await getExistingTables();
  const results: { table: string; count: number }[] = [];

  // 使用原生 SQL 关闭 FK 检查
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  // ── 最深层级（无下级业务表） ──
  const deepTables = [
    'practice_records',          // 练习记录（可能不存在）
    'question_favorites',        // 题目收藏（可能不存在）
    'certificate_verification_logs',
    'certificate_approval_logs',
    'score_audit_logs',
    'grading_reviews',
    'video_course_logs',
    'video_progresses',
    'video_course_courses',
    'evaluation_instructor_ratings',
    'import_logs',
    'export_logs',
  ];
  for (const table of deepTables) {
    await tryDelete(table, existingTables, results);
  }

  // ── 依赖中层 ──
  const midTables = [
    'exam_answers',
    'grading_assignments',
    'ScoreAppeal',               // 注意：无 @@map，表名为 ScoreAppeal（首字母大写）
    'certificate_traces',
    'certificate_applications',
    'certificates',
    'exam_sessions',
    'learning_hour_records',
    'evaluations',
    'schedules',
    'attendance_records',
    'business_evidences',
    'enrollment_agency_enrollments',
    'program_status_logs',
    'program_enrollments',
  ];
  for (const table of midTables) {
    await tryDelete(table, existingTables, results);
  }

  // ── 清除 User 对 batch 的引用 ──
  const updated = await tryUpdate(
    'UPDATE users SET batch_id = NULL, graduated_at = NULL WHERE batch_id IS NOT NULL',
    existingTables
  );
  if (updated > 0) {
    console.log(`   ↪ users: batch_id 清除 ${updated} 条`);
  }

  // ── 引用全部清完后再删父表 ──
  const parentTables = [
    'program_batches',
    'courses',
    'course_videos',
    'video_courses',
    'materials',
    'material_chapters',
    'material_questions',
    'exams',
    'instructors',
    'notifications',
    'attachments',
    'fee_records',
    'audit_logs',
  ];
  for (const table of parentTables) {
    await tryDelete(table, existingTables, results);
  }

  // ── 最父表 ──
  const rootTables = [
    'training_programs',
    'paper_questions',
    'question_options',
    'question_blanks',
    'question_sub_questions',
    'papers',
    'paper_templates',
    'questions',
  ];
  for (const table of rootTables) {
    await tryDelete(table, existingTables, results);
  }

  // 重新启用 FK 检查
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  // ── 统计保留的结构数据 ──
  const keepList = [
    'users', 'roles', 'organizations', 'enrollment_agencies',
    'data_dictionaries', 'subjects', 'chapters', 'tags',
    'role_permissions', 'site_settings', 'ai_configs',
    'knowledge_chunks', 'paper_template_types', 'cool_down_records',
    'question_tags', 'user_role_assignments',
  ];
  const kept: string[] = [];
  for (const table of keepList) {
    if (!existingTables.has(table)) {
      kept.push(`${table}: 表不存在`);
      continue;
    }
    const [row] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM \`${table}\``
    );
    const label = table === 'user_role_assignments' ? 'UserRoleAssignment'
      : table === 'enrollment_agencies' ? 'EnrollmentAgency'
      : table === 'data_dictionaries' ? 'DataDictionary'
      : table === 'role_permissions' ? 'RolePermission'
      : table === 'site_settings' ? 'SiteSetting'
      : table === 'ai_configs' ? 'AiConfig'
      : table === 'knowledge_chunks' ? 'KnowledgeChunk'
      : table === 'paper_template_types' ? 'PaperTemplateType'
      : table === 'cool_down_records' ? 'CoolDownRecord'
      : table === 'question_tags' ? 'QuestionTag'
      : table.charAt(0).toUpperCase() + table.slice(1);
    kept.push(`${label} x${Number(row.count)}`);
  }

  // ── 输出 ──
  const deletedCount = results.filter((r) => r.count > 0).length;
  console.log(`\n✅ 清理完成 (${deletedCount} 个表有数据删除)`);
  for (const { table, count } of results) {
    if (count > 0) {
      console.log(`  - ${table}: ${count} 条已删除`);
    }
  }
  console.log(`\n✅ 结构数据已保留 (${kept.join(', ')})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ 清理失败:', e);
  process.exit(1);
});
