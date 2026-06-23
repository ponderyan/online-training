# FoxLearn 学员管理模块 — 二期实施指令

> 给 Claude Code 的完整指令。请按照本文档的顺序和范围实现。
> 项目路径：`/Users/ponder/projects/online-training`
> 现有学员管理文件：
>   - 前端列表页：`client/src/app/students/page.tsx`（407行）
>   - 后端 Controller：`server/src/modules/students/students.controller.ts`
>   - 后端 Service：`server/src/modules/students/students.service.ts`
>   - API client：`client/src/lib/api.ts`（students 段在第138行）
>   - Schema User/StudentGroup：`server/prisma/schema.prisma`（58-101行）

---

## 设计总纲

### 三层架构

```
学员列表页（增强）  ←→  学员详情页（新增）  ←→  关联数据（考试/证书/缴费/日志）
      │                      │
      │                  新增接口
      │    ┌────────────────┼────────────────┐
      │    │                │                │
  批量操作               考试记录          证书记录
  导入/导出              接口             接口
```

### 与现有模块的交互

```
学员详情页 ──→ 考试模块：查看学员的考试记录（ ExamSession → Exam ）
学员详情页 ──→ 证书模块：查看学员的证书列表（ Certificate ）
学员详情页 ──→ 缴费记录：新增 FeeRecord 模型
学员详情页 ──→ 审计日志：新增 AuditLog 模型
```

### 实现顺序（共7步）

| Step | 内容 | 工作量 |
|:----:|------|:------:|
| 0 | Prisma Schema 变更 + db push | 小 |
| 1 | 后端：学员详情聚合接口 + 新模型接口 | 中 |
| 2 | 后端：批量导出接口 | 小 |
| 3 | 前端：API client 扩展 | 小 |
| 4 | 前端：学员详情页 | 大 |
| 5 | 前端：学员列表页增强 | 中 |
| 6 | 测试联调 | 中 |

---

## Step 0 — Prisma Schema 变更

### 0.1 User 模型扩展

在 `server/prisma/schema.prisma` 的 `model User` 中新增以下字段（插入在 `groupId` 行和 `isActive` 行之间，以及 `isActive` 之后）：

```prisma
// 学员扩展字段
studentNumber String?  @map("student_number") @unique @db.VarChar(50) // 学号
phone         String?  @db.VarChar(20)
email         String?  @db.VarChar(100)
organization  String?  @db.VarChar(200) // 工作单位/机构
groupId       Int?     @map("group_id") // 所属分组

// ── 新增：学员扩展字段 ──
title         String?  @db.VarChar(100)  // 职务/职位
gender        String?  @db.VarChar(10)   // 性别: M / F
idCard        String?  @unique @map("id_card") @db.VarChar(18)  // 身份证号
source        String?  @map("source") @db.VarChar(20)           // 来源渠道
remark        String?  @map("remark") @db.Text                  // 备注
tags          String?  @map("tags")                             // 标签，JSON 数组

// ── 新增：协会场景专用 ──
feeStatus     String?  @default("UNPAID") @map("fee_status") @db.VarChar(20) // UNPAID / PAID / PARTIAL
enrolledAt    DateTime? @map("enrolled_at")
graduatedAt   DateTime? @map("graduated_at")

// ── 新增：审计追踪 ──
lastLoginAt   DateTime? @map("last_login_at")
loginCount    Int       @default(0) @map("login_count")

isActive     Boolean  @default(true) @map("is_active")
createdAt    DateTime @default(now()) @map("created_at")
updatedAt    DateTime @updatedAt @map("updated_at")
```

同时新增关联：
```prisma
group         StudentGroup?         @relation(fields: [groupId], references: [id])
examSessions  ExamSession[]
feeRecords    FeeRecord[]   // 新增
auditLogs     AuditLog[]    // 新增
// certificate 关联保持 Certificate[] 不动（如果已经有的话）
```

> 注意：`tags` 字段用 `String?`（非 JSON 类型），因为 MySQL Prisma JSON 支持有限，前端存取时 JSON.parse/stringify。

### 0.2 StudentGroup 模型扩展

在 `model StudentGroup` 中新增：

```prisma
model StudentGroup {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100) // 分组名称（如 "DTM一期班"）
  note      String?  @db.Text // 说明

  // ── 新增 ──
  description String?  @db.Text     // 班级描述
  startedAt   DateTime? @map("started_at")   // 开班日期
  endedAt     DateTime? @map("ended_at")     // 结课日期
  headTeacher String?  @map("head_teacher")  // 班主任

  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members User[]

  @@map("student_groups")
}
```

### 0.3 新增 FeeRecord 模型

在 `schema.prisma` 中 `model StudentGroup` 之后添加：

```prisma
// ═══════════════════════════════════════════
// 学员缴费记录
// ═══════════════════════════════════════════

model FeeRecord {
  id        Int      @id @default(autoincrement())
  studentId Int      @map("student_id")
  student   User     @relation(fields: [studentId], references: [id])

  examId    Int?     @map("exam_id")                // 关联考试（培训费/考试费）
  type      String   @db.VarChar(20)                // TRAINING_FEE / EXAM_FEE / CERTIFICATE_FEE
  amount    Decimal  @db.Decimal(10, 2)
  status    String   @default("PAID") @db.VarChar(20) // PAID / REFUNDED / PARTIAL
  paidAt    DateTime @map("paid_at")
  method    String?  @db.VarChar(20)                // 支付方式：银行转账/微信/支付宝/现金
  invoiceNo String?  @map("invoice_no") @db.VarChar(100) // 发票号
  note      String?  @db.Text

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([studentId])
  @@index([examId])
  @@map("fee_records")
}
```

### 0.4 新增 AuditLog 模型

```prisma
// ═══════════════════════════════════════════
// 审计日志（数据变更追踪）
// ═══════════════════════════════════════════

model AuditLog {
  id           Int      @id @default(autoincrement())
  entityType   String   @db.VarChar(50)  // 实体类型：User / ExamSession / ExamAnswer / Certificate
  entityId     Int                        // 实体ID
  action       String   @db.VarChar(20)  // CREATE / UPDATE / DELETE
  before       String?  @db.Json         // 修改前数据
  after        String?  @db.Json         // 修改后数据
  operatorId   Int?     @map("operator_id")
  operatorName String?  @map("operator_name")
  ip           String?  @db.VarChar(45)
  createdAt    DateTime @default(now()) @map("created_at")

  student      User?    @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### 0.5 执行 db push

```bash
cd server
npx prisma db push
```

检查输出是否有 warning/error。如果有字段冲突（如 idCard 的唯一约束与已有 null 值冲突），先手动清理或改为非 unique。

---

## Step 1 — 后端：学员详情聚合接口

### 1.1 新增接口列表

所有接口放在 `students.controller.ts`（已有），Service 方法放在 `students.service.ts`。

```
GET  /api/students/:id/profile         → 学员基本信息 + 统计摘要
GET  /api/students/:id/exam-history    → 考试记录（分页）
GET  /api/students/:id/certificates    → 证书记录
GET  /api/students/:id/fee-records     → 缴费记录
GET  /api/students/:id/audit-logs      → 审计日志（分页）
PUT  /api/students/:id/reset-password  → 重置密码
POST /api/students/:id/fee-records     → 添加缴费记录（管理员手动）
```

### 1.2 新增 Controller 方法

在 `students.controller.ts` 的 `students.module.ts` 确保 `FeeRecord` 和 `AuditLog` 的 Prisma service 可用：

```typescript
// students.controller.ts — 新增方法

@Get(':id/profile')
getProfile(@Param('id', ParseIntPipe) id: number) {
  return this.service.getProfile(id);
}

@Get(':id/exam-history')
getExamHistory(
  @Param('id', ParseIntPipe) id: number,
  @Query('page') page?: string,
  @Query('pageSize') pageSize?: string,
) {
  return this.service.getExamHistory(id, {
    page: page ? parseInt(page) : 1,
    pageSize: pageSize ? parseInt(pageSize) : 10,
  });
}

@Get(':id/certificates')
getCertificates(@Param('id', ParseIntPipe) id: number) {
  return this.service.getCertificates(id);
}

@Get(':id/fee-records')
getFeeRecords(@Param('id', ParseIntPipe) id: number) {
  return this.service.getFeeRecords(id);
}

@Post(':id/fee-records')
addFeeRecord(
  @Param('id', ParseIntPipe) id: number,
  @Body() data: {
    type: string; amount: number; paidAt: string;
    method?: string; invoiceNo?: string; note?: string; examId?: number;
  },
) {
  return this.service.addFeeRecord(id, data);
}

@Get(':id/audit-logs')
getAuditLogs(
  @Param('id', ParseIntPipe) id: number,
  @Query('page') page?: string,
  @Query('pageSize') pageSize?: string,
) {
  return this.service.getAuditLogs(id, {
    page: page ? parseInt(page) : 1,
    pageSize: pageSize ? parseInt(pageSize) : 20,
  });
}

@Put(':id/reset-password')
resetPassword(@Param('id', ParseIntPipe) id: number) {
  return this.service.resetPassword(id);
}
```

### 1.3 新增 Service 方法

在 `students.service.ts` 中新增以下方法：

```typescript
// ── 学员详情聚合 ──

async getProfile(id: number) {
  // 1. 查基本信息
  const student = await this.prisma.user.findFirst({
    where: { id, role: 'STUDENT' },
    select: {
      id: true, username: true, displayName: true, role: true,
      studentNumber: true, phone: true, email: true, organization: true,
      title: true, gender: true, idCard: true, source: true, remark: true,
      tags: true, feeStatus: true,
      groupId: true, isActive: true,
      enrolledAt: true, graduatedAt: true,
      lastLoginAt: true, loginCount: true,
      createdAt: true, updatedAt: true,
      group: { select: { id: true, name: true } },
    },
  });
  if (!student) throw new NotFoundException('学员不存在');

  // 2. 统计
  const [examCount, passedCount, certCount] = await Promise.all([
    this.prisma.examSession.count({ where: { studentId: id, status: 'SUBMITTED' } }),
    this.prisma.examSession.count({ where: { studentId: id, status: 'SUBMITTED', isPassed: true } }),
    this.prisma.certificate.count({ where: { studentId: id, isRevoked: false } }),
  ]);

  return {
    ...student,
    // 身份证脱敏
    idCard: student.idCard
      ? student.idCard.substring(0, 3) + '***********' + student.idCard.substring(14)
      : null,
    stats: {
      totalExams: examCount,
      passedExams: passedCount,
      passRate: examCount > 0 ? Math.round((passedCount / examCount) * 100) : 0,
      totalCertificates: certCount,
    },
  };
}

async getExamHistory(id: number, params: { page: number; pageSize: number }) {
  const { page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const where = { studentId: id, status: 'SUBMITTED' };

  const [items, total] = await Promise.all([
    this.prisma.examSession.findMany({
      where,
      select: {
        id: true,
        examId: true,
        exam: { select: { title: true } },
        totalScore: true,
        subjectiveScore: true,
        finalScore: true,
        isPassed: true,
        scoringStatus: true,
        status: true,
        startedAt: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    this.prisma.examSession.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async getCertificates(id: number) {
  const certs = await this.prisma.certificate.findMany({
    where: { studentId: id },
    orderBy: { issueDate: 'desc' },
    select: {
      id: true, certificateNo: true, courseName: true,
      issueDate: true, isRevoked: true, revokedAt: true, revokeReason: true,
    },
  });
  return certs;
}

async getFeeRecords(id: number) {
  const records = await this.prisma.feeRecord.findMany({
    where: { studentId: id },
    orderBy: { paidAt: 'desc' },
  });
  return records;
}

async addFeeRecord(id: number, data: {
  type: string; amount: number; paidAt: string;
  method?: string; invoiceNo?: string; note?: string; examId?: number;
}) {
  // 检查学员存在
  const student = await this.prisma.user.findFirst({ where: { id, role: 'STUDENT' } });
  if (!student) throw new NotFoundException('学员不存在');

  const record = await this.prisma.feeRecord.create({
    data: {
      studentId: id,
      examId: data.examId || null,
      type: data.type,
      amount: data.amount,
      status: 'PAID',
      paidAt: new Date(data.paidAt),
      method: data.method || null,
      invoiceNo: data.invoiceNo || null,
      note: data.note || null,
    },
  });

  // 自动更新 feeStatus
  await this.updateFeeStatus(id);

  return record;
}

// 内部方法：根据缴费记录汇总更新 feeStatus
private async updateFeeStatus(studentId: number) {
  const records = await this.prisma.feeRecord.findMany({ where: { studentId } });
  if (records.length === 0) {
    await this.prisma.user.update({ where: { id: studentId }, data: { feeStatus: 'UNPAID' } });
    return;
  }
  const hasPaid = records.some(r => r.status === 'PAID');
  const hasUnpaid = records.some(r => r.status === 'UNPAID');
  await this.prisma.user.update({
    where: { id: studentId },
    data: { feeStatus: hasPaid && !hasUnpaid ? 'PAID' : 'PARTIAL' },
  });
}

async getAuditLogs(id: number, params: { page: number; pageSize: number }) {
  const { page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const where = { entityType: 'User', entityId: id };

  const [items, total] = await Promise.all([
    this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    this.prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async resetPassword(id: number) {
  const student = await this.prisma.user.findUnique({ where: { id } });
  if (!student) throw new NotFoundException('学员不存在');

  // 生成8位随机密码
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const password = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const passwordHash = await bcryptjs.hash(password, 10);

  await this.prisma.user.update({ where: { id }, data: { passwordHash } });

  return { generatedPassword: password };
}
```

### 1.4 列表接口增强（现有 findAll 方法）

在 `findAll` 方法中，扩展 select 包含新增字段和统计：

```typescript
async findAll(params: {
  page?: number; pageSize?: number; keyword?: string;
  groupId?: number; status?: string;
  // 新增筛选
  source?: string; feeStatus?: string;
  dateFrom?: string; dateTo?: string;
}) {
  // ... 现有代码 ...

  // 新增筛选条件
  if (params.source) where.source = params.source;
  if (params.feeStatus) where.feeStatus = params.feeStatus;
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  // 扩展 select
  const [items, total] = await Promise.all([
    this.prisma.user.findMany({
      where,
      select: {
        id: true, username: true, displayName: true, role: true,
        studentNumber: true, phone: true, email: true, organization: true,
        title: true, gender: true, source: true, feeStatus: true,
        groupId: true, isActive: true, lastLoginAt: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
        // 统计：考试次数
        _count: { select: { examSessions: { where: { status: 'SUBMITTED' } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    this.prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
```

Controller 的 findAll 参数也要扩展：

```typescript
@Get()
findAll(
  @Query('page') page?: string,
  @Query('pageSize') pageSize?: string,
  @Query('keyword') keyword?: string,
  @Query('groupId') groupId?: string,
  @Query('status') status?: string,
  // 新增
  @Query('source') source?: string,
  @Query('feeStatus') feeStatus?: string,
  @Query('dateFrom') dateFrom?: string,
  @Query('dateTo') dateTo?: string,
) {
  return this.service.findAll({ /* ...全部传入... */ });
}
```

### 1.5 create 方法扩展

在 `create` 方法中，把新字段也写入：

```typescript
async create(data: {
  username: string; displayName: string; password?: string;
  studentNumber?: string; phone?: string; email?: string;
  organization?: string; groupId?: number; role?: string;
  // 新增
  title?: string; gender?: string; idCard?: string;
  source?: string; remark?: string;
  enrolledAt?: string;
}) {
  // ... 现有唯一性检查 ...

  const user = await this.prisma.user.create({
    data: {
      // ... 现有字段 ...
      title: data.title || null,
      gender: data.gender || null,
      idCard: data.idCard || null,
      source: data.source || null,
      remark: data.remark || null,
      enrolledAt: data.enrolledAt ? new Date(data.enrolledAt) : null,
      feeStatus: 'UNPAID',
      // ... 其余字段 ...
    },
    // ... select ...
  });

  return { ...user, generatedPassword: password };
}
```

### 1.6 update 方法扩展

```typescript
async update(id: number, data: {
  // ... 现有字段 ...
  title?: string; gender?: string; idCard?: string;
  source?: string; remark?: string; tags?: string;
  feeStatus?: string; enrolledAt?: string; graduatedAt?: string;
}) {
  // ... 现有代码 ...

  const updateData: any = {};
  // ... 现有字段赋值 ...
  if (data.title !== undefined) updateData.title = data.title;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.idCard !== undefined) updateData.idCard = data.idCard;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.remark !== undefined) updateData.remark = data.remark;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.feeStatus !== undefined) updateData.feeStatus = data.feeStatus;
  if (data.enrolledAt !== undefined) updateData.enrolledAt = data.enrolledAt ? new Date(data.enrolledAt) : null;
  if (data.graduatedAt !== undefined) updateData.graduatedAt = data.graduatedAt ? new Date(data.graduatedAt) : null;

  // ... update ...
}
```

---

## Step 2 — 后端：批量导出接口

### 2.1 新增接口

在 `students.controller.ts`：

```typescript
@Get('export')
async exportStudents(
  @Query('keyword') keyword?: string,
  @Query('groupId') groupId?: string,
  @Query('source') source?: string,
  @Query('feeStatus') feeStatus?: string,
  @Query('status') status?: string,
  @Res() res: Response,
) {
  const data = await this.service.exportStudents({
    keyword, groupId: groupId ? parseInt(groupId) : undefined,
    source, feeStatus, status,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
  // 添加 BOM 使 Excel 正确识别 UTF-8
  res.write('\ufeff');
  // 表头
  const headers = ['用户名', '姓名', '学号', '性别', '手机号', '邮箱', '单位', '职务', '来源', '缴费状态', '班级', '注册日期', '状态'];
  res.write(headers.join(',') + '\n');

  for (const s of data) {
    const row = [
      s.username, s.displayName, s.studentNumber || '', s.gender || '',
      s.phone || '', s.email || '', s.organization || '', s.title || '',
      s.source || '', s.feeStatus || '', s.group?.name || '',
      s.createdAt ? s.createdAt.toISOString().split('T')[0] : '',
      s.isActive ? '正常' : '停用',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    res.write(row.join(',') + '\n');
  }
  res.end();
}
```

### 2.2 Service 方法

```typescript
async exportStudents(params: {
  keyword?: string; groupId?: number;
  source?: string; feeStatus?: string; status?: string;
}) {
  const where: any = { role: 'STUDENT' };
  // ... 复用 findAll 的 where 逻辑 ...

  return this.prisma.user.findMany({
    where,
    select: {
      username: true, displayName: true, studentNumber: true, gender: true,
      phone: true, email: true, organization: true, title: true,
      source: true, feeStatus: true, isActive: true, createdAt: true,
      group: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

> **CSV 导出不依赖第三方库**，用 Node.js 原生 `res.write` 拼接 CSV。字段内容用双引号包裹并转义内部引号，追加 BOM 头 `\ufeff` 以支持 Excel 正确识别中文。

---

## Step 3 — 前端：API client 扩展

在 `client/src/lib/api.ts` 的 `students:` 对象中新增方法：

```typescript
students: {
  // ... 现有方法 ...

  // 新增
  getProfile: (id: number) => request<any>(`/students/${id}/profile`),
  getExamHistory: (id: number, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/students/${id}/exam-history${qs}`);
  },
  getCertificates: (id: number) => request<any[]>(`/students/${id}/certificates`),
  getFeeRecords: (id: number) => request<any[]>(`/students/${id}/fee-records`),
  addFeeRecord: (id: number, data: any) =>
    request<any>(`/students/${id}/fee-records`, { method: 'POST', body: JSON.stringify(data) }),
  getAuditLogs: (id: number, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/students/${id}/audit-logs${qs}`);
  },
  resetPassword: (id: number) =>
    request<any>(`/students/${id}/reset-password`, { method: 'PUT' }),
  exportCsv: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    // 直接下载，用 fetch 拿 blob
    return fetch(`/api/students/export${qs}`).then(res => res.blob());
  },
  // 批量操作
  batchUpdate: (data: { ids: number[]; groupId?: number | null; isActive?: boolean; source?: string }) =>
    request<any>('/students/batch-update', { method: 'POST', body: JSON.stringify(data) }),
},
```

---

## Step 4 — 前端：学员详情页

### 4.1 新建页面文件

创建 `client/src/app/students/[id]/page.tsx`：

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState('exam');

  // Exam history
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [examPage, setExamPage] = useState(1);
  const [examTotal, setExamTotal] = useState(0);

  // Certificates
  const [certificates, setCertificates] = useState<any[]>([]);

  // Fee records
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [showAddFee, setShowAddFee] = useState(false);
  const [feeForm, setFeeForm] = useState({ type: 'TRAINING_FEE', amount: 0, paidAt: new Date().toISOString().split('T')[0], method: '', invoiceNo: '', note: '' });

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);

  // Reset password
  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  const loadProfile = async () => {
    try {
      const p = await api.students.getProfile(Number(id));
      setProfile(p);
    } catch {}
  };

  const loadExamHistory = async (p: number = examPage) => {
    try {
      const data = await api.students.getExamHistory(Number(id), { page: String(p), pageSize: '10' });
      setExamHistory(data.items);
      setExamTotal(data.total);
      setExamPage(data.page);
    } catch {}
  };

  const loadCertificates = async () => {
    try { setCertificates(await api.students.getCertificates(Number(id))); } catch {}
  };

  const loadFeeRecords = async () => {
    try { setFeeRecords(await api.students.getFeeRecords(Number(id))); } catch {}
  };

  const loadAuditLogs = async (p: number = auditPage) => {
    try {
      const data = await api.students.getAuditLogs(Number(id), { page: String(p), pageSize: '20' });
      setAuditLogs(data.items);
      setAuditPage(data.page);
    } catch {}
  };

  useEffect(() => {
    loadProfile();
    loadExamHistory();
    loadCertificates();
    loadFeeRecords();
    loadAuditLogs();
    setLoading(false);
  }, [id]);

  const handleResetPassword = async () => {
    try {
      const res = await api.students.resetPassword(Number(id));
      setNewPwd(res.generatedPassword);
      setShowPwd(true);
    } catch (e: any) { alert('重置失败：' + e.message); }
  };

  if (loading || !profile) {
    return (
      <AppLayout>
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ── 返回按钮 ── */}
      <button onClick={() => router.push('/students')}
        className="btn btn-ghost btn-xs mb-4">
        ← 返回学员列表
      </button>

      {/* ── 顶部信息卡片 ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            {/* 头像占位 */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
              {profile.displayName?.[0] || '?'}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold font-serif">{profile.displayName}</h1>
                <span className={`tag ${profile.isActive ? 'tag-cyan' : 'tag-ink'}`}>
                  {profile.isActive ? '正常' : '已停用'}
                </span>
                <span className="tag" style={{
                  background: profile.feeStatus === 'PAID' ? 'var(--cyan-glow)' :
                    profile.feeStatus === 'PARTIAL' ? 'var(--verm-glow)' : 'var(--paper-dark)',
                  color: profile.feeStatus === 'PAID' ? 'var(--cyan)' :
                    profile.feeStatus === 'PARTIAL' ? 'var(--verm)' : 'var(--ink-300)',
                }}>
                  {profile.feeStatus === 'PAID' ? '已缴费' : profile.feeStatus === 'PARTIAL' ? '部分缴费' : '未缴费'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm" style={{ color: 'var(--ink-400)' }}>
                {profile.studentNumber && <span>学号：{profile.studentNumber}</span>}
                {profile.phone && <span>手机：{profile.phone}</span>}
                {profile.email && <span>邮箱：{profile.email}</span>}
                {profile.organization && <span>单位：{profile.organization}</span>}
                {profile.title && <span>职务：{profile.title}</span>}
                {profile.gender && <span>性别：{profile.gender === 'M' ? '男' : '女'}</span>}
                {profile.idCard && <span>身份证：{profile.idCard}</span>}
                {profile.source && <span>来源：{profile.source}</span>}
                {profile.group?.name && <span>班级：{profile.group.name}</span>}
                <span>注册：{new Date(profile.createdAt).toLocaleDateString('zh-CN')}</span>
                {profile.lastLoginAt && <span>最后登录：{new Date(profile.lastLoginAt).toLocaleString('zh-CN')}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push(`/students/${id}/edit`)} className="btn btn-outline btn-sm">编辑</button>
            <button onClick={handleResetPassword} className="btn btn-outline btn-sm">重置密码</button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-4" style={{ borderTop: '1px solid var(--ink-100)' }}>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--fox)' }}>{profile.stats.totalExams}</div>
            <div className="text-xs" style={{ color: 'var(--ink-300)' }}>总考试</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--cyan)' }}>{profile.stats.passedExams}</div>
            <div className="text-xs" style={{ color: 'var(--ink-300)' }}>通过</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--ink-500)' }}>{profile.stats.passRate}%</div>
            <div className="text-xs" style={{ color: 'var(--ink-300)' }}>通过率</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--verm)' }}>{profile.stats.totalCertificates}</div>
            <div className="text-xs" style={{ color: 'var(--ink-300)' }}>证书</div>
          </div>
        </div>
      </div>

      {/* ── Tab 导航 ── */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '2px solid var(--ink-100)' }}>
        {[
          { key: 'exam', label: '考试记录' },
          { key: 'cert', label: '证书记录' },
          { key: 'fee', label: '缴费记录' },
          { key: 'log', label: '操作日志' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium bg-transparent border-none cursor-pointer"
            style={{
              color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-300)',
              borderBottom: activeTab === tab.key ? '2px solid var(--fox)' : '2px solid transparent',
              marginBottom: '-2px',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 考试记录 ── */}
      {activeTab === 'exam' && (
        <div className="card overflow-hidden">
          {examHistory.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无考试记录</div>
          ) : (
            <>
              <table className="list-table">
                <thead>
                  <tr>
                    <th>考试名称</th>
                    <th>总分</th>
                    <th>最终成绩</th>
                    <th>通过</th>
                    <th>状态</th>
                    <th>交卷时间</th>
                  </tr>
                </thead>
                <tbody>
                  {examHistory.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.exam?.title || '—'}</td>
                      <td>{e.totalScore ?? '—'}</td>
                      <td style={{ fontWeight: 600, color: e.isPassed ? 'var(--cyan)' : 'var(--verm)' }}>
                        {e.finalScore ?? '—'}
                      </td>
                      <td>
                        {e.isPassed === true ? '✅' : e.isPassed === false ? '❌' : '—'}
                      </td>
                      <td>
                        <span className={`tag ${
                          e.scoringStatus === 'PUBLISHED' ? 'tag-cyan' :
                          e.scoringStatus === 'GRADING' ? 'tag-verm' :
                          'tag-ink'
                        }`}>
                          {e.scoringStatus === 'PUBLISHED' ? '已发布' :
                           e.scoringStatus === 'GRADING' ? '阅卷中' :
                           e.scoringStatus === 'GRADED' ? '已阅完' : '待批'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-300)', fontSize: '0.85em' }}>
                        {e.submittedAt ? new Date(e.submittedAt).toLocaleString('zh-CN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {examTotal > 10 && (
                <div className="flex justify-center gap-2 py-3">
                  {/* 分页控件可复用列表页逻辑 */}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: 证书记录 ── */}
      {activeTab === 'cert' && (
        <div className="card overflow-hidden">
          {certificates.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无证书记录</div>
          ) : (
            <table className="list-table">
              <thead>
                <tr>
                  <th>证书编号</th>
                  <th>课程/考试</th>
                  <th>发证日期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c: any) => (
                  <tr key={c.id}>
                    <td><code className="px-1 py-0.5 rounded" style={{ background: 'var(--paper-dark)', fontSize: '0.85em' }}>{c.certificateNo}</code></td>
                    <td>{c.courseName || '—'}</td>
                    <td>{new Date(c.issueDate).toLocaleDateString('zh-CN')}</td>
                    <td>
                      {c.isRevoked
                        ? <span className="tag tag-verm">已撤销</span>
                        : <span className="tag tag-cyan">有效</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: 缴费记录 ── */}
      {activeTab === 'fee' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm" style={{ color: 'var(--ink-400)' }}>共 {feeRecords.length} 条记录</span>
            <button onClick={() => setShowAddFee(true)} className="btn btn-fox btn-sm">💰 记录缴费</button>
          </div>
          <div className="card overflow-hidden">
            {feeRecords.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无缴费记录</div>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>支付方式</th>
                    <th>发票号</th>
                    <th>缴费日期</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRecords.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.type === 'TRAINING_FEE' ? '培训费' : r.type === 'EXAM_FEE' ? '考试费' : '证书费'}</td>
                      <td style={{ fontWeight: 600 }}>¥{Number(r.amount).toFixed(2)}</td>
                      <td><span className={`tag ${r.status === 'PAID' ? 'tag-cyan' : 'tag-verm'}`}>{r.status === 'PAID' ? '已缴' : '已退'}</span></td>
                      <td>{r.method || '—'}</td>
                      <td>{r.invoiceNo || '—'}</td>
                      <td>{new Date(r.paidAt).toLocaleDateString('zh-CN')}</td>
                      <td className="max-w-[120px] truncate">{r.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: 操作日志 ── */}
      {activeTab === 'log' && (
        <div className="card overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>暂无操作日志</div>
          ) : (
            <div className="divide-y" style={{ borderBottom: '1px solid var(--ink-100)' }}>
              {auditLogs.map((log: any) => (
                <div key={log.id} className="p-3 flex items-start gap-3">
                  <div className="text-lg mt-0.5">
                    {log.action === 'CREATE' ? '➕' : log.action === 'UPDATE' ? '✏️' : '🗑️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{log.operatorName || '系统'}</span>
                      <span style={{ color: 'var(--ink-400)' }}>
                        {' '}{log.action === 'CREATE' ? '创建了' : log.action === 'UPDATE' ? '修改了' : '删除了'}学员信息
                      </span>
                    </div>
                    {log.before && log.after && log.action === 'UPDATE' && (
                      <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>
                        {JSON.stringify(JSON.parse(log.before)) !== '{}' && (
                          <span>变更内容：{Object.keys(JSON.parse(log.after)).filter(
                            k => JSON.stringify(JSON.parse(log.before)[k]) !== JSON.stringify(JSON.parse(log.after)[k])
                          ).join('、')}</span>
                        )}
                      </div>
                    )}
                    <div className="text-xs mt-0.5" style={{ color: 'var(--ink-200)' }}>
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                      {log.ip && <span className="ml-2">IP: {log.ip}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: 密码重置 ── */}
      {showPwd && (
        <div className="modal-overlay" onClick={() => setShowPwd(false)}>
          <div className="modal-card max-w-[400px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">🔑 密码已重置</h3>
              <button onClick={() => setShowPwd(false)} className="text-lg bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="modal-body text-center py-6">
              <p className="text-sm mb-2" style={{ color: 'var(--ink-400)' }}>新密码（请立即告知学员并保存）</p>
              <div className="text-2xl font-mono font-bold p-4 rounded" style={{
                background: 'var(--fox-pale)', color: 'var(--fox)', letterSpacing: '0.15em'
              }}>{newPwd}</div>
              <p className="text-xs mt-3" style={{ color: 'var(--verm)' }}>关闭后无法再次查看，请务必复制保存</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPwd(false)} className="btn btn-ink btn-sm">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: 添加缴费记录 ── */}
      {showAddFee && (
        // ... 标准弹窗表单，字段：type(下拉选择TRAINING_FEE/EXAM_FEE/CERTIFICATE_FEE)、amount、paidAt(date input)、method、invoiceNo、note
        // 提交后调用 api.students.addFeeRecord 并刷新列表
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddFee(false); }}>
          <div className="modal-card max-w-[480px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">💰 记录缴费</h3>
              <button onClick={() => setShowAddFee(false)} className="text-lg bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>费用类型 *</label>
                  <select value={feeForm.type} onChange={e => setFeeForm({...feeForm, type: e.target.value})} className="input select">
                    <option value="TRAINING_FEE">培训费</option>
                    <option value="EXAM_FEE">考试费</option>
                    <option value="CERTIFICATE_FEE">证书费</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>金额 *</label>
                  <input type="number" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: Number(e.target.value)})}
                    className="input" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>缴费日期 *</label>
                  <input type="date" value={feeForm.paidAt} onChange={e => setFeeForm({...feeForm, paidAt: e.target.value})}
                    className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>支付方式</label>
                  <select value={feeForm.method} onChange={e => setFeeForm({...feeForm, method: e.target.value})} className="input select">
                    <option value="">请选择</option>
                    <option value="银行转账">银行转账</option>
                    <option value="微信">微信</option>
                    <option value="支付宝">支付宝</option>
                    <option value="现金">现金</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>发票号</label>
                  <input value={feeForm.invoiceNo} onChange={e => setFeeForm({...feeForm, invoiceNo: e.target.value})}
                    className="input" placeholder="选填" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>备注</label>
                  <input value={feeForm.note} onChange={e => setFeeForm({...feeForm, note: e.target.value})}
                    className="input" placeholder="选填" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddFee(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={async () => {
                if (!feeForm.amount || feeForm.amount <= 0) { alert('请输入金额'); return; }
                try {
                  await api.students.addFeeRecord(Number(id), {
                    ...feeForm, paidAt: new Date(feeForm.paidAt).toISOString(),
                  });
                  setShowAddFee(false);
                  setFeeForm({ type: 'TRAINING_FEE', amount: 0, paidAt: new Date().toISOString().split('T')[0], method: '', invoiceNo: '', note: '' });
                  loadFeeRecords();
                  loadProfile(); // 刷新 feeStatus
                } catch (e: any) { alert('保存失败：' + e.message); }
              }} className="btn btn-ink btn-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
```

> 实现时不需要逐字照抄上述代码。核心逻辑是：4个 Tab 页面（考试/证书/缴费/日志）+ 3个交互（查看统计数据、重置密码弹窗、添加缴费记录弹窗）。用 `api.students.xxx` 调接口。样式用现有 `card`、`list-table`、`tag`、`btn` 等 CSS 类保持风格统一。

---

## Step 5 — 前端：学员列表页增强

修改 `client/src/app/students/page.tsx`，需要做的改动：

### 5.1 新增筛选条件

在现有的 keyword 搜索框和班级筛选下拉框旁边，新增：

```tsx
<div className="flex gap-3 mb-5 flex-wrap">
  {/* 现有：搜索框 */}
  <input value={keyword} onChange={e => setKeyword(e.target.value)}
    placeholder="搜索姓名/用户名/学号/手机号…" className="input" style={{ maxWidth: 320 }} />
  
  {/* 现有：班级筛选 */}
  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="input select" style={{ maxWidth: 160 }}>
    <option value="">全部班级</option>
    {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g._count?.members || 0}人)</option>)}
  </select>

  {/* 新增：来源筛选 */}
  <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="input select" style={{ maxWidth: 130 }}>
    <option value="">全部来源</option>
    <option value="SELF">自主报名</option>
    <option value="AGENCY">机构推荐</option>
    <option value="COMPANY">单位委派</option>
    <option value="INVITE">定向邀请</option>
  </select>

  {/* 新增：缴费状态筛选 */}
  <select value={filterFeeStatus} onChange={e => setFilterFeeStatus(e.target.value)} className="input select" style={{ maxWidth: 120 }}>
    <option value="">缴费状态</option>
    <option value="PAID">已缴费</option>
    <option value="PARTIAL">部分缴费</option>
    <option value="UNPAID">未缴费</option>
  </select>

  {/* 新增：导出按钮 */}
  <button onClick={handleExport} className="btn btn-outline btn-sm">📥 导出</button>
</div>
```

### 5.2 新增表格列

在表格 thead 中新增列（在「状态」列之前）：

```tsx
<th>性别</th>
<th>来源</th>
<th>缴费</th>
<th>考试数</th>
<th>最后登录</th>
```

对应 tbody 中的单元格：

```tsx
<td>{s.gender === 'M' ? '♂' : s.gender === 'F' ? '♀' : '—'}</td>
<td>{s.source ? <span className="tag tag-ghost" style={{ fontSize: '0.75em' }}>{sourceLabel(s.source)}</span> : '—'}</td>
<td>
  <span className="tag" style={{
    background: s.feeStatus === 'PAID' ? 'var(--cyan-glow)' : s.feeStatus === 'PARTIAL' ? 'var(--verm-glow)' : 'transparent',
    color: s.feeStatus === 'PAID' ? 'var(--cyan)' : s.feeStatus === 'PARTIAL' ? 'var(--verm)' : 'var(--ink-300)',
    border: '1px solid ' + (s.feeStatus === 'PAID' ? 'var(--cyan)' : s.feeStatus === 'PARTIAL' ? 'var(--verm)' : 'var(--ink-200)'),
  }}>
    {s.feeStatus === 'PAID' ? '已缴' : s.feeStatus === 'PARTIAL' ? '部分' : '未缴'}
  </span>
</td>
<td style={{ textAlign: 'center' }}>{s._count?.examSessions || 0}</td>
<td style={{ color: 'var(--ink-300)', fontSize: '0.85em' }}>
  {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('zh-CN') : '—'}
</td>
```

### 5.3 行操作新增「查看」按钮

在「编辑」按钮之前增加：

```tsx
<button onClick={() => router.push(`/students/${s.id}`)} className="btn btn-ghost btn-xs">查看</button>
```

### 5.4 新增来源标签映射函数

```tsx
const sourceLabel = (s: string) => {
  const map: Record<string, string> = {
    SELF: '自主报名', AGENCY: '机构推荐',
    COMPANY: '单位委派', INVITE: '定向邀请',
  };
  return map[s] || s;
};
```

### 5.5 新增导出函数

```tsx
const handleExport = async () => {
  try {
    const blob = await api.students.exportCsv({
      ...(keyword && { keyword }),
      ...(filterGroup && { groupId: filterGroup }),
      ...(filterSource && { source: filterSource }),
      ...(filterFeeStatus && { feeStatus: filterFeeStatus }),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学员导出_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) { alert('导出失败：' + e.message); }
};
```

### 5.6 添加/编辑弹窗表单扩展

在添加/编辑弹窗中增加新字段的表单项：

```tsx
<select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
  className="input select">
  <option value="">选择性别</option>
  <option value="M">男</option>
  <option value="F">女</option>
</select>

<select value={form.source} onChange={e => setForm({...form, source: e.target.value})}
  className="input select">
  <option value="">选择来源</option>
  <option value="SELF">自主报名</option>
  <option value="AGENCY">机构推荐</option>
  <option value="COMPANY">单位委派</option>
  <option value="INVITE">定向邀请</option>
</select>

<input value={form.idCard} onChange={e => setForm({...form, idCard: e.target.value})}
  className="input" placeholder="身份证号" maxLength={18} />
```

### 5.7 批量导入升级

在批量导入弹窗中增加：
- 模板下载按钮（生成一个示例 CSV 并触发下载）
- 预览区域（解析后显示前几行）

---

## Step 6 — 导航：侧边栏路由

当前侧边栏中学员管理已存在且指向 `/students`。确保：
- 学员列表行点击"查看"跳转到 `/students/[id]` 详情页
- 学员详情页有返回按钮回列表

---

## 关键注意事项

1. **db push 顺序**：修改 schema 后先 `npx prisma db push`，如果有冲突手动解决
2. **身份证号唯一性**：`idCard` 设为 `@unique`，批量导入时如果有多条空身份证号会冲突。要么改为非 unique，要么前端确保空的传 null
3. **CID字段脱敏**：详情页返回的 idCard 要脱敏（前3位+****+后4位），列表页不展示 idCard
4. **批量导出 CSV**：用原生 response.write 拼接，不要引入第三方库。加 BOM `\ufeff` 支持 Excel
5. **批注簿样式一致性**：所有新页面使用现有的 `card`、`list-table`、`tag`、`btn`、`btn-fox`、`btn-sm`、`modal-overlay`、`modal-card` 等 CSS 类
6. **登录计数**：`loginCount` 的递增需要在 auth/login 逻辑中实现（本项目已有 auth 模块，在那里加 `user.update({ where: { id }, data: { loginCount: { increment: 1 }, lastLoginAt: new Date() } })`）
7. **审计日志**：审计日志的记录建议在后续做——三期再实现完整的切面记录。本期先只实现查询接口和日志展示，数据留空或手动写入
8. **FeeRecord 的 user 关联**：如果 Prisma 报 circular reference，可以去掉 `AuditLog` 的 `student` 关联（只用 entityType + entityId 做逻辑关联）
