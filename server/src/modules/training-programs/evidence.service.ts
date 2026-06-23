import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';

const UPLOAD_DIR = path.resolve('uploads/evidences');

@Injectable()
export class EvidenceService {
  constructor(private prisma: PrismaService) {
    fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});
  }

  async upload(programId: number, file: any, evidenceType: string, notes: string | undefined, userId: number) {
    const fileName = `${Date.now()}-${file.originalname}`;
    const fileUrl = path.join(UPLOAD_DIR, fileName);
    await fs.writeFile(fileUrl, file.buffer);

    return this.prisma.businessEvidence.create({
      data: {
        programId, evidenceType: evidenceType || 'ATTENDANCE_SHEET',
        fileName: file.originalname, fileUrl, fileSize: file.buffer.length,
        fileType: file.mimetype || 'application/octet-stream',
        uploadedById: userId, notes: notes || null,
      },
    });
  }

  async findById(evidenceId: number) {
    return this.prisma.businessEvidence.findUnique({ where: { id: evidenceId } });
  }

  async findByProgram(programId: number) {
    return this.prisma.businessEvidence.findMany({
      where: { programId },
      include: { uploadedBy: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(evidenceId: number) {
    const ev = await this.prisma.businessEvidence.findUnique({ where: { id: evidenceId } });
    if (!ev) throw new NotFoundException('文件不存在');
    await fs.unlink(ev.fileUrl).catch(() => {});
    return this.prisma.businessEvidence.delete({ where: { id: evidenceId } });
  }

  async generateSigninSheet(programId: number) {
    const program = await this.prisma.trainingProgram.findUnique({
      where: { id: programId },
      include: {
        schedules: { include: { course: true }, orderBy: { startTime: 'asc' } },
        enrollments: { include: { student: { select: { displayName: true, organization: true } } } },
      },
    });
    if (!program) throw new NotFoundException('培训班不存在');

    const workbook = new ExcelJS.Workbook();
    const students = program.enrollments.map(e => ({ name: e.student?.displayName || '未知', org: e.student?.organization || '' }));

    for (const schedule of program.schedules) {
      const dateStr = schedule.startTime.toISOString().slice(0, 10);
      const ws = workbook.addWorksheet(`${dateStr.replace(/-/g, '')}签到表`);
      ws.mergeCells('A1:D1');
      ws.getCell('A1').value = `${program.name} — 签到表`;
      ws.getCell('A1').font = { size: 14, bold: true };
      ws.getCell('A2').value = `地点：${schedule.location || program.location || ''}    日期：${dateStr}`;
      ws.getCell('A2').font = { size: 11 };
      ws.getRow(4).values = ['序号', '姓名', '推荐单位', '签名'];
      ws.getRow(4).font = { bold: true };
      students.forEach((s: any, i: number) => {
        ws.addRow([i + 1, s.name, s.org, '']);
      });
      ws.columns = [{ width: 6 }, { width: 14 }, { width: 24 }, { width: 20 }];
      ws.pageSetup = { orientation: 'portrait', paperSize: 9 };
      ws.getRow(4).eachCell(c => { c.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }; });
    }

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
    return { buffer, fileName: `签到表_${program.name}_${new Date().toISOString().slice(0, 10)}.xlsx` };
  }
}
