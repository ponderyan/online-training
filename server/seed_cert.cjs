const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTestCert() {
  // Find or create a minimal exam session
  let session = await prisma.examSession.findFirst();
  if (!session) {
    const course = await prisma.course.findFirst();
    if (!course) {
      console.log('No courses found — creating dummy course...');
      const dict = await prisma.dataDictionary.findFirst();
      const subject = await prisma.subject.findFirst();
      if (!subject) {
        console.log('No subject, create that...');
      }
    }
    console.log('Need exam session — checking students...');
  }

  // Just find stu001
  const student = await prisma.user.findUnique({ where: { username: 'stu001' } });
  const program = await prisma.trainingProgram.findFirst();
  
  if (!student) {
    console.log('stu001 not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`Student: ${student.id} - ${student.displayName}`);
  console.log(`Program: ${program ? program.id + ' ' + program.name : 'none'}`);

  // Try to create an exam session first
  if (!session) {
    const course = await prisma.course.findFirst();
    const exam = await prisma.exam.findFirst();
    if (course && exam) {
      session = await prisma.examSession.create({
        data: {
          courseId: course.id,
          examId: exam.id,
          status: 'COMPLETED',
          startTime: new Date(),
          endTime: new Date(),
        }
      });
      console.log(`Created exam session: ${session.id}`);
    }
  }

  if (!session) {
    console.log('Cannot create exam session — need a course and exam. Creating...');
    const dict = await prisma.dataDictionary.findFirst();
    const subject = await prisma.subject.findFirst();
    
    if (subject) {
      const course = await prisma.course.create({
        data: {
          name: '数智化管理师认证课程',
          subjectId: subject.id,
          description: '测试课程',
          status: 'PUBLISHED',
          instructorId: student.id,
        }
      });
      const exam = await prisma.exam.create({
        data: {
          name: '数智化管理师认证考试',
          subjectId: subject.id,
          duration: 120,
          totalScore: 100,
          passingScore: 60,
          status: 'PUBLISHED',
        }
      });
      session = await prisma.examSession.create({
        data: {
          courseId: course.id,
          examId: exam.id,
          status: 'COMPLETED',
          startTime: new Date(),
          endTime: new Date(),
        }
      });
      console.log(`Created course=${course.id}, exam=${exam.id}, session=${session.id}`);
    }
  }

  if (session) {
    // Create test certificate
    const cert = await prisma.certificate.create({
      data: {
        examSessionId: session.id,
        studentId: student.id,
        certificateNo: 'FX-CERT-20260706-0001',
        studentName: student.displayName,
        courseName: '数智化管理师认证课程',
        verificationCode: 'ABCD1234EFGH5678',
        approvalStatus: 'APPROVED',
        approvedBy: 1,
        approvedAt: new Date(),
        programId: program?.id || null,
      }
    });
    console.log(`✅ Created test certificate: id=${cert.id} no=${cert.certificateNo}`);
    console.log(`   Verification code: ${cert.verificationCode}`);
    console.log(`\n   Try: GET /api/certificates/${cert.id}/pdf`);
    console.log(`   Try: GET /api/certificates/verify?no=${cert.certificateNo}&code=${cert.verificationCode}`);
    console.log(`   QR scan: http://localhost:3000/verify-certificate?no=${cert.certificateNo}&code=${cert.verificationCode}`);
  }

  await prisma.$disconnect();
}

seedTestCert().catch(e => { console.error(e); process.exit(1); });
