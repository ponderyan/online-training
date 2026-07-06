const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentId = 1;
  
  try {
    // Test exact queries from the service
    console.log('1. getSummary examSessions...');
    const sessions = await prisma.examSession.findMany({
      where: { studentId, submittedAt: { not: null } },
      select: { isPassed: true, finalScore: true },
    });
    console.log('OK:', sessions.length);

    console.log('2. getSummary hours...');
    const hours = await prisma.learningHourRecord.findMany({
      where: { studentId },
      select: { hours: true, status: true },
    });
    console.log('OK:', hours.length);

    console.log('3. certificates...');
    const certs = await prisma.learningHourCertificate.count({ where: { applicantId: studentId } });
    console.log('OK:', certs);

    console.log('4. pending count...');
    const pending = await prisma.examSession.count({
      where: { studentId, status: 'SUBMITTED', finalScore: null },
    });
    console.log('OK:', pending);

    console.log('5. getExamTrend...');
    const trend = await prisma.examSession.findMany({
      where: { studentId, status: 'SUBMITTED', finalScore: { not: null } },
      include: { exam: { include: { paper: { select: { totalScore: true } } } } },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });
    console.log('OK:', trend.length);

    console.log('6. getHoursDistribution...');
    const dist = await prisma.learningHourRecord.findMany({
      where: { studentId, status: 'APPROVED' },
      include: { type: { select: { id: true, name: true, code: true } } },
    });
    console.log('OK:', dist.length);

    console.log('7. getLearningActivity examSessions...');
    const actSessions = await prisma.examSession.findMany({
      where: { studentId, submittedAt: { not: null, gte: new Date(Date.now() - 30*86400000) } },
      select: { submittedAt: true },
    });
    console.log('OK:', actSessions.length);

    console.log('8. videoProgress...');
    const vp = await prisma.videoProgress.findMany({
      where: { studentId, updatedAt: { gte: new Date(Date.now() - 30*86400000), completed: true } },
    });
    console.log('OK:', vp.length);

    console.log('8b. videoProgress (just updatedAt and completed)...');
    const vp2 = await prisma.videoProgress.findMany({
      where: { studentId, updatedAt: { gte: new Date(Date.now() - 30*86400000) }, completed: true },
      select: { updatedAt: true },
    });
    console.log('OK:', vp2.length);

    console.log('9. practiceRecord...');
    const prs = await prisma.practiceRecord.findMany({
      where: { studentId, createdAt: { gte: new Date(Date.now() - 30*86400000) } },
      select: { createdAt: true },
    });
    console.log('OK:', prs.length);

    console.log('10. programEnrollment...');
    const enrolls = await prisma.programEnrollment.findMany({
      where: { studentId },
      include: { program: { select: { id: true, name: true, exams: { select: { id: true } } } } },
    });
    console.log('OK:', enrolls.length);

    console.log('All queries passed!');
  } catch(e) {
    console.error('ERROR:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
