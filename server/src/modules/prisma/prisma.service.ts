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
  StudentGroup: 'StudentGroup', Instructor: 'Instructor',
  Course: 'Course', Schedule: 'Schedule', ProgramEnrollment: 'ProgramEnrollment',
  Material: 'Material', Subject: 'Subject', Chapter: 'Chapter',
  PaperTemplate: 'PaperTemplate', GradingAssignment: 'GradingAssignment',
  GradingReview: 'GradingReview', CertificateApplication: 'CertificateApplication',
};

/** 审计日志写入（全局可用的独立函数，可在 PrismaClient 实例外调用） */
async function writeAuditLog(prisma: PrismaClient, params: {
  entityType: string; entityId: number; action: string; before?: any; after?: any;
}) {
  const ctx = requestContext.getStore();
  if (!ctx?.userId) return;
  if (!MODEL_TO_ENTITY[params.entityType]) return;
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        before: params.before || undefined,
        after: params.after || undefined,
        operatorId: ctx.userId,
        operatorName: ctx.userName || '',
        ip: ctx.ip || '',
      },
    });
  } catch {}
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

          const result = await query(args);
          if (!WRITE_ACTIONS.has(operation)) return result;

          const entityType = MODEL_TO_ENTITY[model];
          if (!entityType) return result;

          const action = ACTION_MAP[operation] || 'UPDATE';
          const entityId = result?.id || args?.where?.id;
          if (entityId !== undefined && entityId !== null) {
            writeAuditLog(this as any, {
              entityType,
              entityId,
              action,
              after: action !== 'DELETE' ? JSON.parse(JSON.stringify(result)) : undefined,
            });
          }
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
    entityType: string; entityId: number; action: string; before?: any; after?: any;
  }) {
    return writeAuditLog(this as any, params);
  }
}
