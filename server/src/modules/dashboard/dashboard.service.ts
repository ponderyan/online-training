import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activePrograms,
      totalStudents,
      totalInstructors,
      pendingGrading,
      pendingAppeals,
      pendingCertificates,
      recentPrograms,
      upcomingExams,
      monthlyNewStudents,
    ] = await Promise.all([
      // 进行中的培训班
      this.prisma.trainingProgram.count({ where: { status: 'IN_PROGRESS' } }),
      // 学员总数（通过 UserRoleAssignment 查询）
      this.getUserCountByRole('STUDENT'),
      // 讲师总数
      this.prisma.instructor.count({ where: { status: 'ACTIVE' } }),
      // 待阅卷（已提交但未判完的 session）
      this.prisma.examSession.count({
        where: { status: 'SUBMITTED', scoringStatus: { in: ['PENDING', 'GRADING'] } },
      }),
      // 待审核申诉
      this.prisma.scoreAppeal.count({ where: { status: 'PENDING' } }),
      // 待审批证书记录申请
      this.prisma.certificateApplication.count({ where: { status: 'PENDING' } }),
      // 最近 5 个培训班
      this.prisma.trainingProgram.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true },
      }),
      // 最近 3 场考试（未结束的）
      this.prisma.exam.findMany({
        where: { status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
        orderBy: { startTime: 'asc' },
        take: 3,
        select: { id: true, title: true, startTime: true, endTime: true, status: true },
      }),
      // 本月新增学员（通过 UserRoleAssignment 查询）
      this.getNewUserCountByRole('STUDENT', startOfMonth),
    ]);

    // 过去7天判卷趋势
    const gradingTrend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.scoreAuditLog.count({
        where: {
          action: 'ADJUST',
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });
      // Also count sessions that changed to GRADED status in this period
      const gradedCount = await this.prisma.examSession.count({
        where: {
          scoringStatus: { in: ['GRADED', 'PUBLISHED', 'CONFIRMED'] },
          updatedAt: { gte: dayStart, lt: dayEnd },
        },
      });

      gradingTrend.push({
        date: dayStart.toISOString().slice(0, 10),
        count: count + Math.round(gradedCount * 0.3), // approximate
      });
    }

    return {
      activePrograms,
      totalStudents,
      totalInstructors,
      pendingGrading,
      pendingAppeals,
      pendingCertificates,
      recentPrograms,
      upcomingExams,
      gradingTrend,
      monthlyNewStudents,
    };
  }

  /** 通过角色 code 统计用户数 */
  private async getUserCountByRole(code: string): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) return 0;
    return this.prisma.userRoleAssignment.count({ where: { roleId: role.id, user: { isActive: true } } });
  }

  /** 通过角色 code 统计某时间后新增的用户数 */
  private async getNewUserCountByRole(code: string, after: Date): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) return 0;
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });
    const userIds = assignments.map(a => a.userId);
    if (userIds.length === 0) return 0;
    return this.prisma.user.count({
      where: { id: { in: userIds }, createdAt: { gte: after }, isActive: true },
    });
  }
}
