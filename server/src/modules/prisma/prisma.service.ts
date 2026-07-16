import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { requestContext } from '../../common/utils/request-context.js';

const WRITE_ACTIONS = new Set(['create', 'update', 'delete', 'updateMany', 'deleteMany']);

const ACTION_MAP: Record<string, string> = {
  create: 'CREATE', update: 'UPDATE', delete: 'DELETE',
  updateMany: 'UPDATE', deleteMany: 'DELETE',
};

const MODEL_TO_ENTITY: Record<string, string> = {
  User: 'User', Exam: 'Exam', Certificate: 'Certificate',
  Paper: 'Paper', Question: 'Question', TrainingProgram: 'TrainingProgram',
  ExamSession: 'ExamSession', ScoreAppeal: 'ScoreAppeal',
  Instructor: 'Instructor', Course: 'Course', Schedule: 'Schedule',
  ProgramEnrollment: 'ProgramEnrollment',
  Material: 'Material', Subject: 'Subject', Chapter: 'Chapter',
  PaperTemplate: 'PaperTemplate', GradingAssignment: 'GradingAssignment',
  GradingReview: 'GradingReview', CertificateApplication: 'CertificateApplication',
  Role: 'Role', Evaluation: 'Evaluation', Notification: 'Notification',
  EnrollmentAgencyEnrollment: 'Filing', VideoCourse: 'VideoCourse',
  AttendanceRecord: 'AttendanceRecord', BusinessEvidence: 'BusinessEvidence',
  SystemConfig: 'SystemConfig',
};

/** 关键实体列表：这些实体的 UPDATE 操作会额外捕获 Before 快照 */
const BEFORE_TRACK_ENTITIES = new Set([
  'Exam', 'Paper', 'Question', 'User', 'Certificate', 'ScoreAppeal',
]);

/** 审计日志写入（全局可用的独立函数，可在 PrismaClient 实例外调用） */
async function writeAuditLog(prisma: PrismaClient, params: {
  entityType: string; entityId: number | null; action: string; before?: any; after?: any; changeReason?: string;
}) {
  const ctx = requestContext.getStore();
  // 允许系统操作（无 userId）写入，用 0 表示系统
  const operatorId = ctx?.userId ?? 0;
  const operatorName = ctx?.userName ?? (operatorId === 0 ? '系统自动操作' : '');
  // 推断操作来源：无 userId = SYSTEM，有 userId = API（后续可从 context 扩展 CRON/MANUAL 标记）
  const eventSource = ctx?.eventSource || (operatorId === 0 ? 'SYSTEM' : 'API');
  // P3-1：模型未映射时开发环境 warn
  if (!MODEL_TO_ENTITY[params.entityType]) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AuditMiddleware] Missing entity mapping for model: ${params.entityType}`);
    }
    return;
  }
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId ?? -1,
        action: params.action,
        before: params.before || undefined,
        after: params.after || undefined,
        operatorId,
        operatorName,
        changeReason: params.changeReason || ctx?.changeReason || undefined,
        eventSource,
        ip: ctx?.ip || '',
      },
    });
  } catch (e) {
    // P3-2：写入失败时输出 warn，不再静默吞错
    console.warn(`[AuditMiddleware] Failed to write audit log: ${(e as Error)?.message || e}`);
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();

    // ── 注册审计日志中间件 ──
    // 使用 Prisma v6 的 $extends 自动拦截所有写操作并写入 audit_log
    // 因为 $use 在 Prisma v6 已被移除，改用 $extends + assign 模式
    /**
     * ⚠️ 开发规范：新增任何包含 orgId 字段的 model 时，必须同步把 model 名加入此 Set。
     * 否则该 model 的数据不会被自动隔离到当前用户的机构。
     *
     * 当前受 org 隔离的 model：
     *   - User（用户所属机构）
     *   - TrainingProgram（培训班所属机构）
     *
     * 仅包含直接拥有 orgId 字段的模型。其他无 orgId 字段的模型通过关联关系间接实现数据隔离。
     * 后续可扩展为通过 Prisma 关系路径自动解析。
     */
    const ORG_SCOPE_MODELS = new Set([
      'User',
      'TrainingProgram',
    ]);

    const extended = (this as any).$extends({
      query: {
        $allOperations: async ({ model, operation, args, query }: any) => {
          // ── orgId 数据隔离 ──
          // 在读操作（findMany/findFirst/findUnique/count）时自动注入 orgId
          const isReadOp = ['findMany', 'findFirst', 'findUnique', 'count'].includes(operation);
          if (isReadOp && model && ORG_SCOPE_MODELS.has(model)) {
            const ctx = requestContext.getStore();
            if (ctx?.orgId && !ctx.isSuperAdmin) {
              if (!args.where) args.where = {};
              // 如果查询中已经有 orgId 条件，不覆盖
              if (args.where.orgId === undefined) {
                args.where.orgId = ctx.orgId;
              }
            }
          }

          // P2-1：关键实体 UPDATE 前先查旧值（Before 快照）
          let beforeSnapshot: any = undefined;
          if (operation === 'update' && model && BEFORE_TRACK_ENTITIES.has(MODEL_TO_ENTITY[model] ?? '')) {
            try {
              const before = await (this as any)[model].findUnique({ where: args.where });
              if (before) beforeSnapshot = JSON.parse(JSON.stringify(before));
            } catch {
              // 查不到旧值不影响主流程
            }
          }

          const result = await query(args);
          if (!WRITE_ACTIONS.has(operation)) return result;

          const entityType = MODEL_TO_ENTITY[model];
          if (!entityType) return result;

          const action = ACTION_MAP[operation] || 'UPDATE';

          // P0-2：实体ID分层提取
          let entityId: number | null = null;
          if (operation === 'update' || operation === 'delete') {
            // 单条操作：从 where 中取单主键 id
            entityId = args?.where?.id ?? null;
          } else if (operation === 'create') {
            entityId = result?.id ?? null;
          } else if (operation === 'updateMany' || operation === 'deleteMany') {
            // 批量操作不关联单一实体，entityId = null
            entityId = null;
          }

          writeAuditLog(this as any, {
            entityType,
            entityId,
            action,
            before: beforeSnapshot,
            after: action !== 'DELETE' ? JSON.parse(JSON.stringify(result)) : undefined,
          });
          return result;
        },
      },
    });

    // 将 extended client 的属性复制到当前实例
    // 这样所有注入 PrismaService 的地方都能自动获得审计能力
    for (const key of Object.keys(extended)) {
      if (key !== '$extends' && key !== '$on' && key !== '$connect' && key !== '$disconnect' && key !== '$use') {
        (this as any)[key] = (extended as any)[key];
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async recordAudit(params: {
    entityType: string; entityId: number; action: string; before?: any; after?: any; changeReason?: string;
  }) {
    return writeAuditLog(this as any, params);
  }
}
