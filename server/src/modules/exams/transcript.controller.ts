import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/exams')
export class TranscriptController {
  constructor(private prisma: PrismaService) {}

  @Get(':examId/transcript')
  @RequirePermission(Permissions.TRANSCRIPT_VIEW)
  async getTranscript(@Param('examId', ParseIntPipe) examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { paper: { include: { questions: { include: { question: { select: { type: true } } }, orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!exam) return { error: '考试不存在' };

    const sessions = await this.prisma.examSession.findMany({
      where: { examId, scoringStatus: { in: ['PUBLISHED', 'ADJUSTED'] } },
      include: { student: { select: { id: true, displayName: true, username: true, organization: true } } },
      orderBy: { finalScore: 'desc' },
    });

    return {
      examTitle: exam.title,
      totalStudents: sessions.length,
      averageScore: sessions.length > 0 ? sessions.reduce((s, s2) => s + (s2.finalScore || 0), 0) / sessions.length : 0,
      passCount: sessions.filter(s => s.isPassed).length,
      failCount: sessions.filter(s => !s.isPassed).length,
      scores: sessions.map((s, idx) => ({
        rank: idx + 1,
        student: s.student,
        totalScore: s.totalScore,
        subjectiveScore: s.subjectiveScore,
        finalScore: s.finalScore,
        isPassed: s.isPassed,
        scoringStatus: s.scoringStatus,
        submittedAt: s.submittedAt,
      })),
    };
  }
}
