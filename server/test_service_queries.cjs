const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sid = 1;
  try {
    console.log('1. cert count...');
    const c = await prisma.certificate.count({ where: { studentId: sid, isRevoked: false } });
    console.log('OK:', c);

    console.log('2. exam sessions...');
    const s = await prisma.examSession.findMany({
      where: { studentId: sid, submittedAt: { not: null } },
      select: { isPassed: true, finalScore: true },
    });
    console.log('OK:', s.length);

    console.log('3. hour records...');
    const h = await prisma.learningHourRecord.findMany({
      where: { studentId: sid },
      select: { hours: true, status: true },
    });
    console.log('OK:', h.length);

    console.log('4. exam trend...');
    const t = await prisma.examSession.findMany({
      where: { studentId: sid, status: 'SUBMITTED', finalScore: { not: null } },
      include: { exam: { include: { paper: { select: { totalScore: true } } } } },
      orderBy: { submittedAt: 'desc' }, take: 10,
    });
    console.log('OK:', t.length);

    console.log('5. hours distribution...');
    const d = await prisma.learningHourRecord.findMany({
      where: { studentId: sid, status: 'APPROVED' },
      include: { type: { select: { id: true, name: true, code: true } } },
    });
    console.log('OK:', d.length);

    console.log('6. program enrollment...');
    const e = await prisma.programEnrollment.findMany({
      where: { studentId: sid },
      include: { program: { select: { id: true, name: true, exams: { select: { id: true } } } } },
    });
    console.log('OK:', e.length);

    console.log('7. answers...');
    const a = await prisma.examAnswer.findMany({
      where: { session: { studentId: sid }, isCorrect: { not: null } },
      select: { questionId: true, isCorrect: true, sessionId: true },
      take: 5,
    });
    console.log('OK:', a.length);

    console.log('ALL QUERIES PASSED');
  } catch(e) {
    console.error('ERROR:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
