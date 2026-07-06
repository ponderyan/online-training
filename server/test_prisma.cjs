const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentId = 1;
  
  try {
    console.log('1. examSessions...');
    const examSessions = await prisma.examSession.findMany({
      where: { studentId, submittedAt: { not: null } },
      select: { isPassed: true, scores: true },
    });
    console.log('OK:', examSessions.length);

    console.log('2. hours...');
    const hours = await prisma.learningHourRecord.findMany({
      where: { studentId },
      select: { hours: true, status: true },
    });
    console.log('OK:', hours.length);

    console.log('3. learningHourCertificate...');
    const certs = await prisma.learningHourCertificate.count({ where: { applicantId: studentId } });
    console.log('OK:', certs);

    console.log('4. videoProgress...');
    const vp = await prisma.videoProgress.findMany({
      where: { studentId, updatedAt: { gte: new Date(Date.now() - 30*86400000) } },
    });
    console.log('OK:', vp.length);

    console.log('5. practiceRecord...');
    const prs = await prisma.practiceRecord.findMany({
      where: { studentId, createdAt: { gte: new Date(Date.now() - 30*86400000) } },
    });
    console.log('OK:', prs.length);

    console.log('6. programEnrollment...');
    const enrolls = await prisma.programEnrollment.findMany({
      where: { studentId },
      include: { program: { select: { id: true, name: true, exams: { select: { id: true } } } } },
    });
    console.log('OK:', enrolls.length);
    
    console.log('All queries passed!');
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
