import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** 全链审计事件 */
export interface TrailEvent {
  id: string;
  timestamp: string;
  eventType: string; // STATE_CHANGE | ASSIGNMENT | SUBMISSION | GRADING | APPEAL | SCORE_ADJUST | CERT_ISSUE
  eventName: string;
  fromState?: string;
  toState?: string;
  operatorName: string; // 脱敏：只显示姓名不显示ID
  summary: string;
  relatedAuditLogIds: number[];
  detail?: any;
}

export interface TrailResult {
  entityType: string;
  entityId: number;
  entityName: string;
  events: TrailEvent[];
}

@Injectable()
export class AuditTrailService {
  constructor(private prisma: PrismaService) {}

  async getTrail(entityType: string, entityId: number): Promise<TrailResult> {
    const type = entityType.toUpperCase();
    if (type === 'EXAM') return this.getExamTrail(entityId);
    if (type === 'PROGRAM') return this.getProgramTrail(entityId);
    return { entityType: type, entityId, entityName: '', events: [] };
  }

  /** 搜索业务实体，供前端选择器使用 */
  async searchEntities(entityType: string, keyword: string) {
    const type = (entityType || 'EXAM').toUpperCase();
    const kw = (keyword || '').trim();
    if (type === 'EXAM') {
      const where: any = kw ? { title: { contains: kw } } : {};
      const items = await this.prisma.exam.findMany({
        where, select: { id: true, title: true, status: true },
        orderBy: { id: 'desc' }, take: 20,
      });
      return { entityType: 'EXAM', items };
    }
    if (type === 'PROGRAM') {
      const where: any = kw ? { name: { contains: kw } } : {};
      const items = await this.prisma.trainingProgram.findMany({
        where, select: { id: true, name: true, status: true },
        orderBy: { id: 'desc' }, take: 20,
      });
      return { entityType: 'PROGRAM', items };
    }
    return { entityType: type, items: [] };
  }

  // ═════════════════════════ 考试全链审计 ═══════════════════════════

  private async getExamTrail(examId: number): Promise<TrailResult> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, status: true },
    });
    if (!exam) return { entityType: 'EXAM', entityId: examId, entityName: '', events: [] };

    // 并行查询所有数据源（certificates 依赖 sessions 的 id，放后面单独查）
    const [auditLogs, sessions, gradingAssignments, appeals, scoreAdjusts] = await Promise.all([
      // 1. 状态变更（audit_logs）
      this.prisma.auditLog.findMany({
        where: { entityType: 'Exam', entityId: examId },
        orderBy: { createdAt: 'asc' },
      }),
      // 2. 学员分配 + 开考/交卷（exam_sessions）
      this.prisma.examSession.findMany({
        where: { examId },
        include: { student: { select: { displayName: true } } },
        orderBy: { id: 'asc' },
      }),
      // 3. 判分（grading_assignments）
      this.prisma.gradingAssignment.findMany({
        where: { examId },
        include: { grader: { select: { displayName: true } } },
        orderBy: { assignedAt: 'asc' },
      }),
      // 4. 申诉（score_appeals）
      this.prisma.scoreAppeal.findMany({
        where: { examId },
        include: { student: { select: { displayName: true } }, reviewer: { select: { displayName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      // 5. 成绩调整（score_audit_logs，无 student 关系，需单独查学员名）
      this.prisma.scoreAuditLog.findMany({
        where: { examId, studentId: { not: 0 } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // 6. 发证（certificates，通过 examSessionId 关联该考试的 sessions）
    const certificates = sessions.length > 0
      ? await this.prisma.certificate.findMany({
          where: { examSessionId: { in: sessions.map(s => s.id) } },
          orderBy: { issueDate: 'asc' },
        })
      : [];

    const events: TrailEvent[] = [];

    // ── 状态变更事件 ──
    for (const log of auditLogs) {
      const beforeStatus = (log.before as any)?.status;
      const afterStatus = (log.after as any)?.status;
      const actionLabel = log.action === 'CREATE' ? '创建考试' : log.action === 'DELETE' ? '删除考试' : '编辑考试';
      events.push({
        id: `audit-${log.id}`,
        timestamp: log.createdAt.toISOString(),
        eventType: 'STATE_CHANGE',
        eventName: actionLabel,
        fromState: beforeStatus,
        toState: afterStatus,
        operatorName: log.operatorName || '系统',
        summary: beforeStatus && afterStatus && beforeStatus !== afterStatus
          ? `状态变更：${beforeStatus} → ${afterStatus}`
          : actionLabel,
        relatedAuditLogIds: [log.id],
        detail: { before: log.before, after: log.after, changeReason: log.changeReason },
      });
    }

    // ── 学员分配事件（按时间窗口聚合，相近的算一批） ──
    const assignmentBatches = this.groupAssignments(sessions);
    for (const batch of assignmentBatches) {
      events.push({
        id: `assign-${batch.firstId}`,
        timestamp: batch.timestamp.toISOString(),
        eventType: 'ASSIGNMENT',
        eventName: '分配学员',
        operatorName: '管理员',
        summary: `分配了 ${batch.count} 名学员`,
        relatedAuditLogIds: [],
      });
    }

    // ── 开考/交卷事件 ──
    for (const s of sessions) {
      if (s.startedAt) {
        events.push({
          id: `start-${s.id}`,
          timestamp: s.startedAt.toISOString(),
          eventType: 'SUBMISSION',
          eventName: '学员开考',
          operatorName: s.student?.displayName || `学员#${s.studentId}`,
          summary: `${s.student?.displayName || `学员#${s.studentId}`} 开始答题`,
          relatedAuditLogIds: [],
        });
      }
      if (s.submittedAt) {
        events.push({
          id: `submit-${s.id}`,
          timestamp: s.submittedAt.toISOString(),
          eventType: 'SUBMISSION',
          eventName: '学员交卷',
          operatorName: s.student?.displayName || `学员#${s.studentId}`,
          summary: `${s.student?.displayName || `学员#${s.studentId}`} 提交答卷`,
          relatedAuditLogIds: [],
        });
      }
    }

    // ── 判分事件 ──
    for (const g of gradingAssignments) {
      const graderName = g.grader?.displayName || '系统';
      if (g.status === 'PENDING') {
        events.push({
          id: `grade-assign-${g.id}`,
          timestamp: g.assignedAt.toISOString(),
          eventType: 'GRADING',
          eventName: '判分任务分配',
          operatorName: '管理员',
          summary: `分配判分任务给 ${graderName}`,
          relatedAuditLogIds: [],
        });
      } else if (g.completedAt) {
        events.push({
          id: `grade-done-${g.id}`,
          timestamp: g.completedAt.toISOString(),
          eventType: 'GRADING',
          eventName: '判分完成',
          operatorName: graderName,
          summary: `${graderName} 完成判分`,
          relatedAuditLogIds: [],
        });
      }
    }

    // ── 申诉事件 ──
    for (const a of appeals) {
      const studentName = a.student?.displayName || `学员#${a.studentId}`;
      events.push({
        id: `appeal-${a.id}`,
        timestamp: a.createdAt.toISOString(),
        eventType: 'APPEAL',
        eventName: '发起申诉',
        operatorName: studentName,
        summary: `${studentName} 发起成绩申诉${a.reason ? `：${a.reason}` : ''}`,
        relatedAuditLogIds: [],
        detail: { oldScore: a.oldScore, newScore: a.newScore, status: a.status },
      });
      if (a.status !== 'PENDING' && a.reviewedAt) {
        const reviewerName = a.reviewer?.displayName || '管理员';
        events.push({
          id: `appeal-resolve-${a.id}`,
          timestamp: a.reviewedAt.toISOString(),
          eventType: 'APPEAL',
          eventName: a.status === 'APPROVED' ? '申诉通过' : '申诉驳回',
          operatorName: reviewerName,
          summary: `${reviewerName} ${a.status === 'APPROVED' ? '通过' : '驳回'}了 ${studentName} 的申诉`,
          relatedAuditLogIds: [],
          detail: { oldScore: a.oldScore, newScore: a.newScore, status: a.status },
        });
      }
    }

    // ── 成绩调整事件（ScoreAuditLog 无 student 关系，用 studentId 查学员名） ──
    const adjustStudentIds = [...new Set(scoreAdjusts.map(s => s.studentId))];
    const adjustStudents = adjustStudentIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: adjustStudentIds } }, select: { id: true, displayName: true } })
      : [];
    const adjustStudentMap = new Map(adjustStudents.map(u => [u.id, u.displayName]));
    for (const sa of scoreAdjusts) {
      const studentName = adjustStudentMap.get(sa.studentId) || `学员#${sa.studentId}`;
      events.push({
        id: `adjust-${sa.id}`,
        timestamp: sa.createdAt.toISOString(),
        eventType: 'SCORE_ADJUST',
        eventName: '成绩调整',
        operatorName: sa.operatorName || '管理员',
        summary: `${studentName} 成绩 ${sa.oldValue ?? '?'} → ${sa.newValue ?? '?'}${sa.reason ? `（${sa.reason}）` : ''}`,
        relatedAuditLogIds: [],
        detail: { fromScore: sa.oldValue, toScore: sa.newValue, reason: sa.reason, field: sa.fieldName },
      });
    }

    // ── 发证事件 ──
    for (const c of certificates) {
      if (c.isRevoked && c.revokedAt) {
        events.push({
          id: `cert-revoke-${c.id}`,
          timestamp: c.revokedAt.toISOString(),
          eventType: 'CERT_ISSUE',
          eventName: '证书吊销',
          operatorName: '管理员',
          summary: `${c.studentName} 的证书被吊销`,
          relatedAuditLogIds: [],
          detail: { revokeReason: c.revokeReason },
        });
      } else {
        events.push({
          id: `cert-${c.id}`,
          timestamp: c.issueDate.toISOString(),
          eventType: 'CERT_ISSUE',
          eventName: '证书发放',
          operatorName: '系统',
          summary: `${c.studentName} 获得证书`,
          relatedAuditLogIds: [],
        });
      }
    }

    // 全部按时间降序排序
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { entityType: 'EXAM', entityId: examId, entityName: exam.title, events };
  }

  /** 将 exam_sessions 按创建时间分组（5分钟内的算一批分配） */
  private groupAssignments(sessions: any[]): { firstId: number; timestamp: Date; count: number }[] {
    if (sessions.length === 0) return [];
    const batches: { firstId: number; timestamp: Date; count: number }[] = [];
    let current: { firstId: number; timestamp: Date; count: number } | null = null;
    const WINDOW_MS = 5 * 60 * 1000; // 5分钟窗口

    for (const s of sessions) {
      const ts = s.startedAt || s.createdAt;
      if (!ts) continue;
      if (current && ts.getTime() - current.timestamp.getTime() <= WINDOW_MS) {
        current.count++;
      } else {
        if (current) batches.push(current);
        current = { firstId: s.id, timestamp: ts, count: 1 };
      }
    }
    if (current) batches.push(current);
    return batches;
  }

  // ═════════════════════════ 培训班全链审计（基础版） ═══════════════════════════

  private async getProgramTrail(programId: number): Promise<TrailResult> {
    const program = await this.prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: { id: true, name: true, status: true },
    });
    if (!program) return { entityType: 'PROGRAM', entityId: programId, entityName: '', events: [] };

    const [auditLogs, enrollments, certificates] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entityType: 'TrainingProgram', entityId: programId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.programEnrollment.findMany({
        where: { programId },
        include: { student: { select: { displayName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.certificate.findMany({
        where: { programId },
        orderBy: { issueDate: 'asc' },
      }),
    ]);

    const events: TrailEvent[] = [];

    // 状态变更
    for (const log of auditLogs) {
      const beforeStatus = (log.before as any)?.status;
      const afterStatus = (log.after as any)?.status;
      const actionLabel = log.action === 'CREATE' ? '创建培训班' : log.action === 'DELETE' ? '删除培训班' : '编辑培训班';
      events.push({
        id: `audit-${log.id}`,
        timestamp: log.createdAt.toISOString(),
        eventType: 'STATE_CHANGE',
        eventName: actionLabel,
        fromState: beforeStatus,
        toState: afterStatus,
        operatorName: log.operatorName || '系统',
        summary: beforeStatus && afterStatus && beforeStatus !== afterStatus
          ? `状态变更：${beforeStatus} → ${afterStatus}`
          : actionLabel,
        relatedAuditLogIds: [log.id],
        detail: { before: log.before, after: log.after, changeReason: log.changeReason },
      });
    }

    // 报名事件（按时间窗口聚合）
    if (enrollments.length > 0) {
      const WINDOW_MS = 5 * 60 * 1000;
      let batchStart = enrollments[0].createdAt;
      let batchCount = 1;
      for (let i = 1; i < enrollments.length; i++) {
        const ts = enrollments[i].createdAt;
        if (ts && batchStart && ts.getTime() - batchStart.getTime() <= WINDOW_MS) {
          batchCount++;
        } else {
          events.push({
            id: `enroll-${i}`,
            timestamp: (batchStart || new Date()).toISOString(),
            eventType: 'ASSIGNMENT',
            eventName: '学员报名',
            operatorName: '系统',
            summary: `报名了 ${batchCount} 名学员`,
            relatedAuditLogIds: [],
          });
          batchStart = ts;
          batchCount = 1;
        }
      }
      events.push({
        id: `enroll-last`,
        timestamp: (batchStart || new Date()).toISOString(),
        eventType: 'ASSIGNMENT',
        eventName: '学员报名',
        operatorName: '系统',
        summary: `报名了 ${batchCount} 名学员`,
        relatedAuditLogIds: [],
      });
    }

    // 发证事件
    for (const c of certificates) {
      events.push({
        id: `cert-${c.id}`,
        timestamp: c.issueDate.toISOString(),
        eventType: 'CERT_ISSUE',
        eventName: '证书发放',
        operatorName: '系统',
        summary: `${c.studentName} 获得证书`,
        relatedAuditLogIds: [],
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { entityType: 'PROGRAM', entityId: programId, entityName: program.name, events };
  }
}
