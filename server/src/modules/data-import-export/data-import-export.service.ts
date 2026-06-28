import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class DataImportExportService {
  private readonly SHEET_LIMIT = 10000;

  constructor(private prisma: PrismaService) {}

  private get db() { return this.prisma as any; }

  async import(module: string, file: any, operatorId: number) {
    let rows: string[][];

    // CSV support
    const mimetype = file.mimetype || '';
    if (mimetype === 'text/csv' || mimetype === 'application/csv' || file.originalname?.endsWith('.csv')) {
      const csvContent = file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter((l: string) => l.trim());
      rows = lines.slice(1).map((line: string) => line.split(',').map((c: string) => c.trim()));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const ws = workbook.worksheets[0];
      if (!ws) throw new BadRequestException('文件为空');
      rows = [];
      ws.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const values: string[] = [];
        row.eachCell((cell: any) => values.push(cell.value));
        rows.push(values);
      });
    }

    const log: any = { module, fileName: file.originalname, totalRows: rows.length, successRows: 0, failRows: 0, errors: [] };

    if (module === 'students') await this.importStudents(rows, log, operatorId);
    else if (module === 'questions') await this.importQuestions(rows, log);
    else if (module === 'exams') await this.importExams(rows, log, operatorId);
    else if (module === 'certificates') await this.importCertificates(rows, log);
    else throw new BadRequestException(`不支持的导入模块: ${module}`);

    await this.db.importLog.create({
      data: {
        module: log.module, fileName: log.fileName, totalRows: log.totalRows,
        successRows: log.successRows, failRows: log.failRows,
        errors: log.errors.length > 0 ? log.errors : null, operatorId,
      },
    });

    return { totalRows: log.totalRows, successRows: log.successRows, failRows: log.failRows, errors: log.errors.slice(0, 20) };
  }

  async importExams(rows: string[][], log: any, operatorId: number) {
    for (let i = 0; i < rows.length; i++) {
      const [title, paperId, startTime, endTime, durationMinutes, accessType, passingScore, status] = rows[i];
      try {
        if (!title || !paperId) throw new Error('标题和试卷ID为必填');
        const paper = await this.db.paper.findUnique({ where: { id: parseInt(String(paperId)) } });
        if (!paper) throw new Error(`试卷ID ${paperId} 不存在`);
        await this.db.exam.create({
          data: {
            title: String(title).trim(), paperId: parseInt(String(paperId)), createdBy: operatorId,
            startTime: startTime ? new Date(String(startTime)) : new Date(),
            endTime: endTime ? new Date(String(endTime)) : new Date(),
            durationMinutes: durationMinutes ? parseInt(String(durationMinutes)) : 60,
            accessType: accessType || 'UNIFIED', status: status || 'PUBLISHED',
          },
        });
        log.successRows++;
      } catch (e: any) {
        log.failRows++;
        log.errors.push({ row: i + 2, field: 'title', message: e.message });
      }
    }
  }

  async importCertificates(rows: string[][], log: any) {
    for (let i = 0; i < rows.length; i++) {
      const [examSessionId, studentId, certificateNo, studentName, courseName, issueDate] = rows[i];
      try {
        if (!examSessionId || !studentId || !certificateNo) throw new Error('考试记录ID、学员ID和证书编号为必填');
        const es = await this.db.examSession.findUnique({ where: { id: parseInt(String(examSessionId)) } });
        if (!es) throw new Error(`考试记录 ${examSessionId} 不存在`);
        const stu = await this.db.user.findUnique({ where: { id: parseInt(String(studentId)) } });
        if (!stu) throw new Error(`学员 ${studentId} 不存在`);
        const existingCert = await this.db.certificate.findUnique({ where: { certificateNo: String(certificateNo).trim() } });
        if (existingCert) throw new Error(`证书编号 ${certificateNo} 已存在`);
        await this.db.certificate.create({
          data: {
            examSessionId: parseInt(String(examSessionId)), studentId: parseInt(String(studentId)),
            certificateNo: String(certificateNo).trim(),
            studentName: String(studentName || stu.displayName || '').trim(),
            courseName: String(courseName || '').trim(),
            verificationCode: crypto.randomBytes(16).toString('hex'),
            issueDate: issueDate ? new Date(String(issueDate)) : new Date(),
          },
        });
        log.successRows++;
      } catch (e: any) {
        log.failRows++;
        log.errors.push({ row: i + 2, field: 'certificateNo', message: e.message });
      }
    }
  }

  private async importStudents(rows: string[][], log: any, operatorId: number) {
    for (let i = 0; i < rows.length; i++) {
      const [displayName, username, idCard, phone, email, organization, mailingAddress, agencyName, title, gender, studentNumber] = rows[i];
      try {
        if (!displayName || !username) throw new Error('姓名和用户名为必填');
        const u = String(username).trim();
        const existing = await this.db.user.findUnique({ where: { username: u } });
        const data: any = { displayName: String(displayName).trim() };
        if (idCard) data.idCard = String(idCard).trim();
        if (phone) data.phone = String(phone).trim();
        if (email) data.email = String(email).trim();
        if (organization) data.organization = String(organization).trim();
        if (mailingAddress) data.mailingAddress = String(mailingAddress).trim();
        if (title) data.title = String(title).trim();
        if (gender) data.gender = String(gender).trim();
        if (studentNumber) data.studentNumber = String(studentNumber).trim();

        // 招生机构名称 → primaryAgencyId
        if (agencyName) {
          const name = String(agencyName).trim();
          let agency = await this.db.enrollmentAgency.findFirst({ where: { name } });
          if (!agency) {
            agency = await this.db.enrollmentAgency.create({ data: { name, isActive: true } });
          }
          data.primaryAgencyId = agency.id;
        }

        if (existing) {
          await this.db.user.update({ where: { id: existing.id }, data });
        } else {
          data.username = u;
          data.passwordHash = await bcrypt.hash('123456', 10);
          const newUser = await this.db.user.create({ data });
          // 分配 STUDENT 角色
          const studentRole = await this.db.role.findUnique({ where: { code: 'STUDENT' } });
          if (studentRole) {
            await this.db.userRoleAssignment.upsert({
              where: { userId_roleId: { userId: newUser.id, roleId: studentRole.id } },
              create: { userId: newUser.id, roleId: studentRole.id },
              update: {},
            });
          }
        }
        log.successRows++;
      } catch (e: any) {
        log.failRows++;
        log.errors.push({ row: i + 2, field: 'displayName', message: e.message });
      }
    }
  }

  private async importQuestions(rows: string[][], log: any) {
    const validTypes = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CASE_STUDY'];
    const validDifficulties = ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'];

    for (let i = 0; i < rows.length; i++) {
      const [_type, content, subjectCode, _difficulty, _optionsStr, _answer, _chapterName, analysis] = rows[i];
      try {
        if (!content) throw new Error('题目内容不能为空');
        const subject = await this.db.subject.findFirst({ where: { code: String(subjectCode || '').trim() } });
        if (!subject) throw new Error(`科目编码 ${subjectCode} 不存在`);

        const type = String(_type || 'SINGLE_CHOICE').trim().toUpperCase();
        if (!validTypes.includes(type)) throw new Error(`不支持的题型: ${type}`);

        let diff = String(_difficulty || 'EASY').trim().toUpperCase();
        if (!validDifficulties.includes(diff)) diff = 'EASY';

        // 按章节名称匹配
        let chapterId: number | undefined;
        if (_chapterName) {
          const ch = await this.db.chapter.findFirst({ where: { subjectId: subject.id, name: { contains: String(_chapterName).trim() } } });
          chapterId = ch?.id;
        }

        // 解析选项
        const options: any[] = [];
        const answer = String(_answer || '').trim().toUpperCase();

        if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
          const parts = String(_optionsStr || '').split('|').map((s: string) => s.trim()).filter(Boolean);
          parts.forEach((opt: string, idx: number) => {
            const label = String.fromCharCode(65 + idx);
            const isCorrect = type === 'SINGLE_CHOICE'
              ? label === answer
              : answer.split(',').map(a => a.trim()).includes(label);
            options.push({ label, content: opt, isCorrect, sortOrder: idx });
          });
        } else if (type === 'TRUE_FALSE') {
          options.push({ label: 'T', content: '正确', isCorrect: answer === 'T', sortOrder: 0 });
          options.push({ label: 'F', content: '错误', isCorrect: answer === 'F', sortOrder: 1 });
        }

        const questionData: any = {
          subjectId: subject.id, chapterId, type, content: String(content).trim(),
          difficulty: diff, analysis: analysis ? String(analysis).trim() : undefined,
          status: 'PUBLISHED', isPublic: true,
        };
        if (options.length > 0) questionData.options = { create: options };

        await this.db.question.create({ data: questionData });
        log.successRows++;
      } catch (e: any) {
        log.failRows++;
        log.errors.push({ row: i + 2, field: 'content', message: e.message });
      }
    }
  }

  async export(module: string, query: any, operatorId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const dt = new Date().toISOString().slice(0, 10);

    if (module === 'students') return this.exportStudents(workbook, operatorId, dt);
    if (module === 'exam-sessions') return this.exportExamSessions(workbook, query, operatorId, dt);
    if (module === 'certificates') return this.exportCertificates(workbook, operatorId, dt);
    if (module === 'attendance') return this.exportAttendance(workbook, query, operatorId, dt);
    throw new BadRequestException(`不支持的导出模块: ${module}`);
  }

  private async exportStudents(workbook: ExcelJS.Workbook, operatorId: number, dt: string) {
    const items = await this.db.user.findMany({
      where: { role: 'STUDENT' },
      select: { displayName: true, username: true, phone: true, organization: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const ws = workbook.addWorksheet('学员列表');
    ws.columns = [
      { header: '姓名', key: 'a', width: 16 }, { header: '用户名', key: 'b', width: 16 },
      { header: '手机号', key: 'c', width: 14 }, { header: '单位', key: 'd', width: 24 },
      { header: '创建时间', key: 'e', width: 14 },
    ];
    items.forEach((s: any) => ws.addRow({ a: s.displayName, b: s.username, c: s.phone || '', d: s.organization || '', e: s.createdAt.toISOString().slice(0, 10) }));
    ws.getRow(1).font = { bold: true };
    await this.db.exportLog.create({ data: { module: 'students', totalRows: items.length, operatorId } });
    return { buffer: (await workbook.xlsx.writeBuffer()) as unknown as Buffer, fileName: `学员列表_${dt}.xlsx` };
  }

  private async exportExamSessions(workbook: ExcelJS.Workbook, query: any, operatorId: number, dt: string) {
    const where: any = { status: 'SUBMITTED' };
    if (query.examId) where.examId = parseInt(query.examId);
    const items = await this.db.examSession.findMany({
      where, include: { student: { select: { displayName: true, organization: true } }, exam: { select: { title: true } } },
      orderBy: { id: 'asc' },
    });
    const ws = workbook.addWorksheet('考试成绩');
    ws.columns = [
      { header: '姓名', key: 'a', width: 16 }, { header: '单位', key: 'b', width: 24 },
      { header: '考试名称', key: 'c', width: 30 }, { header: '总分', key: 'd', width: 8 },
      { header: '是否通过', key: 'e', width: 10 }, { header: '交卷时间', key: 'f', width: 14 },
    ];
    items.forEach((s: any) => ws.addRow({
      a: s.student?.displayName || '', b: s.student?.organization || '', c: s.exam?.title || '',
      d: s.finalScore ?? s.totalScore ?? '', e: s.isPassed ? '是' : '否',
      f: s.submittedAt?.toISOString().slice(0, 10) || '',
    }));
    ws.getRow(1).font = { bold: true };
    await this.db.exportLog.create({ data: { module: 'exam-sessions', totalRows: items.length, operatorId } });
    return { buffer: (await workbook.xlsx.writeBuffer()) as unknown as Buffer, fileName: `考试成绩_${dt}.xlsx` };
  }

  private async exportCertificates(workbook: ExcelJS.Workbook, operatorId: number, dt: string) {
    const items = await this.db.certificate.findMany({ orderBy: { issueDate: 'desc' } });
    const ws = workbook.addWorksheet('证书列表');
    ws.columns = [
      { header: '姓名', key: 'a', width: 16 }, { header: '证书编号', key: 'b', width: 24 },
      { header: '课程', key: 'c', width: 30 }, { header: '发证日期', key: 'd', width: 14 },
      { header: '状态', key: 'e', width: 10 },
    ];
    items.forEach((c: any) => ws.addRow({
      a: c.studentName, b: c.certificateNo, c: c.courseName,
      d: c.issueDate.toISOString().slice(0, 10), e: c.isRevoked ? '已撤销' : '有效',
    }));
    ws.getRow(1).font = { bold: true };
    await this.db.exportLog.create({ data: { module: 'certificates', totalRows: items.length, operatorId } });
    return { buffer: (await workbook.xlsx.writeBuffer()) as unknown as Buffer, fileName: `证书列表_${dt}.xlsx` };
  }

  private async addRowsToSheet(ws: any, items: any[], columns: any[], rows: any[]) {
    for (let i = 0; i < items.length; i++) {
      if (i > 0 && i % this.SHEET_LIMIT === 0) {
        ws = ws.workbook.addWorksheet(`${ws.name} (${Math.floor(i / this.SHEET_LIMIT)})`);
        ws.columns = columns;
        ws.getRow(1).font = { bold: true };
      }
      ws.addRow(rows[i]);
    }
  }

  private async exportAttendance(workbook: ExcelJS.Workbook, query: any, operatorId: number, dt: string) {
    const items = await this.db.attendanceRecord.findMany({
      where: query.programId ? { programId: parseInt(query.programId) } : {},
      include: { student: { select: { displayName: true, organization: true } } },
      orderBy: { id: 'asc' },
    });
    const ws = workbook.addWorksheet('出勤记录');
    ws.columns = [
      { header: '序号', key: 'a', width: 6 }, { header: '姓名', key: 'b', width: 16 },
      { header: '单位', key: 'c', width: 24 }, { header: '应到天数', key: 'd', width: 10 },
      { header: '实到天数', key: 'e', width: 10 }, { header: '出勤率', key: 'f', width: 10 },
      { header: '来源', key: 'g', width: 14 },
    ];
    const rows = items.map((r: any) => ({
      b: r.student?.displayName || '',
      c: r.student?.organization || '',
      d: r.totalDays,
      e: r.actualDays,
      f: r.attendanceRate != null ? `${r.attendanceRate}%` : '',
      g: r.source,
    }));
    rows.forEach((r: any, i: number) => ws.addRow({ ...r, a: i + 1 }));
    ws.getRow(1).font = { bold: true };
    await this.db.exportLog.create({ data: { module: 'attendance', totalRows: items.length, operatorId } });
    return { buffer: await workbook.xlsx.writeBuffer() as unknown as Buffer, fileName: `出勤记录_${dt}.xlsx` };
  }

  async getImportLogs(page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.db.importLog.findMany({
        include: { operator: { select: { displayName: true } } },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.db.importLog.count(),
    ]);
    return { items, total, page, pageSize };
  }

  async getExportLogs(params: { page?: number; pageSize?: number; module?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const where: any = {};
    if (params.module) where.module = params.module;
    const [items, total] = await Promise.all([
      this.db.exportLog.findMany({
        where, include: { operator: { select: { displayName: true } } },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.db.exportLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
