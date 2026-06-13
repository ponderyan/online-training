import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 创建默认管理员用户
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: 'admin_temp',
      displayName: '管理员',
    },
  });

  // 2. 创建数据字典
  const dicts = [
    { code: 'DTM', name: '数智化管理师', sortOrder: 1 },
    { code: 'DTC', name: '数智化咨询师', sortOrder: 2 },
    { code: 'DTGV', name: '数据治理工程师', sortOrder: 3 },
    { code: 'DTA', name: '数智化架构师', sortOrder: 4 },
    { code: 'COMMON', name: '通用/公共', sortOrder: 99 },
  ];
  for (const d of dicts) {
    await prisma.dataDictionary.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: d.sortOrder },
      create: d,
    });
  }

  // 3. 创建 DTM 科目
  const dtmDict = await prisma.dataDictionary.findUniqueOrThrow({ where: { code: 'DTM' } });
  const subject = await prisma.subject.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: '数智化管理师',
      code: 'DTM',
      dictionaryId: dtmDict.id,
      sortOrder: 1,
    },
  });

  // 4. 创建章节
  const chapters = [
    { name: '数字化转型概述', sortOrder: 1 },
    { name: '数据驱动决策', sortOrder: 2 },
    { name: 'AI技术基础与应用', sortOrder: 3 },
    { name: '数字化组织与人才', sortOrder: 4 },
    { name: '数据治理与安全', sortOrder: 5 },
    { name: '数字化项目管理', sortOrder: 6 },
    { name: '案例分析', sortOrder: 7 },
  ];
  for (const ch of chapters) {
    await prisma.chapter.create({
      data: { subjectId: subject.id, name: ch.name, sortOrder: ch.sortOrder },
    }).catch(() => {}); // skip if exists
  }

  // 5. 创建标签
  for (const name of ['数据治理', '精益管理', '战略转型', 'AI应用', '通用']) {
    await prisma.tag.create({ data: { name, type: 'domain' } }).catch(() => {});
  }

  console.log('Seed completed!');
  console.log(`  User: ${admin.displayName}`);
  console.log(`  Dictionaries: ${dicts.length}`);
  console.log(`  Chapters: ${chapters.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
