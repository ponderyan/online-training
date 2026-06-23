# Phase A 实施作业单

## 0. 工作范围总览

Phase A 只做"培训班→报名→考试→阅卷→成绩单→证书审批"主流程。
不做：讲师管理、排课、课程评价、学员分组分离。
现有功能逻辑不动，只做加法。

### 数据库变更清单
- **新增** TrainingProgram（培训班次）
- **新增** EnrollmentAgency（招生机构）
- **新增** ProgramEnrollment（学员报名）
- **修改** Exam → 加字段 programId, lateEntryMinutes, earlyExitMinutes, openBookRules
- **修改** ExamSession → 加字段 scoreBreakdown (JSON)
- **修改** Certificate → 加字段 approvalStatus (DRAFT→APPROVED→REVOKED)
- **新增** CertificateApprovalLog（证书审批日志）
- **新增** CertificateApplication（证书申请，学员端发起）

---

## PART 1: Prisma Schema 变更

### 1.1 新增 TrainingProgram（培训班次）

```prisma
model TrainingProgram {
  id            Int       @id @default(autoincrement())
  name          String    @db.VarChar(200)           // 培训班名称："DT+咨询师（DTC）培训"
  code          String    @unique @db.VarChar(50)    // 唯一编号：DT-TC-2026-001
  courseName    String    @map("course_name") @db.VarChar(200) // 课程名称（冗余，用于证书等）"DT+人才培育体系咨询师（DTC）培训"

  // 时间
  startDate     DateTime  @map("start_date")         // 开班日期
  endDate       DateTime  @map("end_date")           // 结课日期
  enrollStart   DateTime  @map("enroll_start")        // 报名开始
  enrollEnd     DateTime  @map("enroll_end")          // 报名截止

  // 费用
  tuitionFee    Float?    @map("tuition_fee")        // 培训费（元）
  examFee       Float?    @map("exam_fee")           // 考试费
  certFee       Float?    @map("cert_fee")           // 证书费

  // 关联
  subjectId     Int       @map("subject_id")         // 关联科目（DataDictionary）
  subject       DataDictionary @relation(fields: [subjectId], references: [id])
  createdBy     Int       @map("created_by")
  creator       User      @relation(fields: [createdBy], references: [id])

  // 状态
  status        String    @default("DRAFT") @db.VarChar(20) // DRAFT / ENROLLING / IN_PROGRESS / FINISHED / CANCELLED

  // 扩展
  description   String?   @db.Text                  // 培训说明
  location      String?   @db.VarChar(200)          // 培训地点
  maxStudents   Int?      @map("max_students")      // 限额人数
  headTeacher   String?   @map("head_teacher")      // 班主任
  remark        String?   @db.Text                  // 备注

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // 关系
  enrollments   ProgramEnrollment[]
  exams         Exam[]                     // 关联的考试

  @@map("training_programs")
}
```

**字段说明：**
- `code` = 唯一业务编号，格式 `DT-TC-YYYY-NNN`（自动生成）
- `courseName` ≠ `name`：`name`是培训班名称（如"DTC2026第一期"），`courseName`是课程全称（如"DT+人才培育体系咨询师（DTC）培训"），证书上用后者
- `status`流转：DRAFT→ENROLLING→IN_PROGRESS→FINISHED→CANCELLED
- `subjectId`关联DataDictionary（DTM、DTC、DTGV等），新版目前用DataDictionary存储科目编码

### 1.2 新增 EnrollmentAgency（招生机构）

```prisma
model EnrollmentAgency {
  id            Int       @id @default(autoincrement())
  name          String    @db.VarChar(200)           // 机构名称
  shortName     String?   @map("short_name") @db.VarChar(50) // 简称
  contactPerson String?   @map("contact_person") @db.VarChar(100) // 联系人
  contactPhone  String?   @map("contact_phone") @db.VarChar(20) // 联系电话
  contactEmail  String?   @map("contact_email") @db.VarChar(100)

  // 统计
  totalEnrolled Int       @default(0) @map("total_enrolled") // 累计招生数

  // 状态
  isActive      Boolean   @default(true) @map("is_active")
  remark        String?   @db.Text

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  enrollments   ProgramEnrollment[]

  @@map("enrollment_agencies")
}
```

### 1.3 新增 ProgramEnrollment（学员报名）

```prisma
model ProgramEnrollment {
  id            Int       @id @default(autoincrement())
  programId     Int       @map("program_id")
  program       TrainingProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  studentId     Int       @map("student_id")
  student       User      @relation(fields: [studentId], references: [id])

  // 招生机构（可选，协会直招不填）
  agencyId      Int?      @map("agency_id")
  agency        EnrollmentAgency? @relation(fields: [agencyId], references: [id])

  // 报名信息
  enrollSource  String?   @map("enroll_source") @db.VarChar(50) // 来源：DIRECT / AGENCY / COMMISSIONED / INVITED
  enrollNote    String?   @map("enroll_note") @db.Text         // 报名备注

  // 缴费
  feeStatus     String    @default("UNPAID") @map("fee_status") @db.VarChar(20) // UNPAID / PAID / PARTIAL / REFUNDED
  feeAmount     Float?    @map("fee_amount")                  // 实缴金额
  paidAt        DateTime? @map("paid_at")

  // 状态
  status        String    @default("ENROLLED") @db.VarChar(20) // ENROLLED / COMPLETED / DROPPED / REFUNDED
  // ENROLLED: 已报名
  // COMPLETED: 已结业
  // DROPPED: 退学
  // REFUNDED: 已退费

  completedAt   DateTime? @map("completed_at")

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@unique([programId, studentId])
  @@index([programId])
  @@index([studentId])
  @@index([agencyId])
  @@map("program_enrollments")
}
```

### 1.4 修改 Exam 表（加培训班关联 + 考试规则）

在已有Exam模型中新增以下字段：

```prisma
// 在现有 Exam 模型中新增：

// 培训班关联（可选，兼容独立考试）
programId         Int?      @map("program_id")
program           TrainingProgram? @relation(fields: [programId], references: [id])

// 考试规则（开卷/闭卷配置）
isOpenBook        Boolean   @default(false) @map("is_open_book") // 是否开卷（已有paper.isOpenBook，这里覆盖）
openBookRules     String?   @map("open_book_rules") @db.Text   // 开卷规则说明（显示在考试页面）

// 进场/交卷规则
lateEntryMinutes  Int?      @map("late_entry_minutes")         // 开考后多少分钟禁止入场（null=不限制）
earlyExitMinutes  Int?      @map("early_exit_minutes")         // 开考后多少分钟可以交卷（null=随时可交，0=全程不可提前交）
```

### 1.5 修改 ExamSession（加 scoreBreakdown）

```prisma
// 在现有 ExamSession 模型中新增：

// 分题型成绩明细 JSON
scoreBreakdown    Json?     @map("score_breakdown")
// 格式：
// {
//   "SINGLE_CHOICE":   { "total": 40, "earned": 32, "count": 20, "correct": 16 },
//   "MULTIPLE_CHOICE": { "total": 0,  "earned": 0,  "count": 0,  "correct": 0 },
//   "TRUE_FALSE":      { "total": 10, "earned": 8,  "count": 10, "correct": 8 },
//   "FILL_BLANK":      { "total": 10, "earned": 7,  "count": 5,  "correct": 3 },
//   "SHORT_ANSWER":    { "total": 20, "earned": 15, "count": 2,  "correct": 0 },
//   "CASE_STUDY":      { "total": 20, "earned": 16, "count": 1,  "correct": 0 }
// }
// 客观题 correct = 答对题数
// 主观题 correct = 0（不用）
```

### 1.6 修改 Certificate（加审批流程）

```prisma
// 在现有 Certificate 模型中新增/修改：

// 审批状态（替代直接用 isRevoked）
approvalStatus    String   @default("DRAFT") @map("approval_status") @db.VarChar(20)
// DRAFT:     草稿（成绩已发布→自动生成申请/系统自动创建草稿证书）
// PENDING:   待审批
// APPROVED:  已审批通过（相当于发证）
// REJECTED:  已驳回
// REVOKED:   已撤销（原 isRevoked）

// 审批人
approvedBy        Int?      @map("approved_by")
approvedAt        DateTime? @map("approved_at")
rejectReason      String?   @map("reject_reason") @db.Text

// 保留原字段，只需修改 isRevoked 的业务含义
// isRevoked = (approvalStatus === 'REVOKED')
```

### 1.7 新增 CertificateApplication（证书申请）

```prisma
model CertificateApplication {
  id            Int       @id @default(autoincrement())
  sessionId     Int       @map("session_id")
  session       ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  studentId     Int       @map("student_id")
  student       User      @relation(fields: [studentId], references: [id])

  // 申请信息
  status        String    @default("PENDING") @db.VarChar(20) // PENDING / APPROVED / REJECTED
  applyNote     String?   @map("apply_note") @db.Text         // 学员申请备注
  appliedAt     DateTime  @default(now()) @map("applied_at")

  // 审批
  reviewedBy    Int?      @map("reviewed_by")
  reviewedAt    DateTime? @map("reviewed_at")
  reviewNote    String?   @map("review_note") @db.Text

  // 关联证书（审批通过后自动生成证书记录）
  certificateId Int?      @map("certificate_id")
  certificate   Certificate? @relation(fields: [certificateId], references: [id])

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@unique([sessionId, studentId])
  @@index([studentId])
  @@index([status])
  @@map("certificate_applications")
}
```

### 1.8 新增 CertificateApprovalLog（证书审批日志）

```prisma
model CertificateApprovalLog {
  id            Int       @id @default(autoincrement())
  certificateId Int       @map("certificate_id")
  certificate   Certificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  action        String    @db.VarChar(20)   // CREATE / SUBMIT / APPROVE / REJECT / REVOKE
  operatorId    Int       @map("operator_id")
  operatorName  String    @map("operator_name") @db.VarChar(100)
  note          String?   @db.Text
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([certificateId])
  @@map("certificate_approval_logs")
}
```

### 1.9 执行命令

修改 schema.prisma 后：

```bash
cd server
npx prisma db push
```

---

## PART 2: API 层变更

### 2.1 新增 TrainingProgramModule

新建文件：
- `server/src/modules/training-programs/training-programs.module.ts`
- `server/src/modules/training-programs/training-programs.controller.ts`
- `server/src/modules/training-programs/training-programs.service.ts`

控制器路径：`api/training-programs`

#### 2.1.1 列表查询

```
GET /api/training-programs?page=1&pageSize=20&keyword=&status=&subjectId=
```

返回：
```json
{
  "items": [
    {
      "id": 1,
      "name": "DTC2026第一期",
      "code": "DT-TC-2026-001",
      "courseName": "DT+人才培育体系咨询师（DTC）培训",
      "startDate": "2026-03-24T00:00:00.000Z",
      "endDate": "2026-03-31T00:00:00.000Z",
      "status": "ENROLLING",
      "subject": { "id": 2, "name": "咨询师（DTC）", "code": "DTC" },
      "enrollments": { "enrolledCount": 45 },
      "exams": [{ "id": 1, "title": "DTC考试" }],
      "createdBy": 1,
      "createdAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

#### 2.1.2 单条详情

```
GET /api/training-programs/:id
```

返回同上但包含完整 enrollments 列表（含学员信息）、完整 exams 列表。

#### 2.1.3 创建

```
POST /api/training-programs
Body:
{
  "name": "DTC2026第一期",
  "courseName": "DT+人才培育体系咨询师（DTC）培训",
  "subjectId": 2,
  "startDate": "2026-03-24T00:00:00Z",
  "endDate": "2026-03-31T00:00:00Z",
  "enrollStart": "2026-03-01T00:00:00Z",
  "enrollEnd": "2026-03-20T00:00:00Z",
  "tuitionFee": 2800,
  "examFee": 300,
  "certFee": 200,
  "description": "DTC第一期培训班",
  "location": "北京",
  "maxStudents": 100,
  "headTeacher": "张老师",
  "createdBy": 1
}
```

注意：`code` 由系统自动生成，格式 `DT-TC-{YYYY}-{NNN}`，NNN从001开始递增。需要在service中实现自动编号逻辑。

#### 2.1.4 更新

```
PUT /api/training-programs/:id
Body: 同创建（只传需修改的字段）
```

限制：只有 DRAFT / ENROLLING 状态的可以编辑。

#### 2.1.5 删除

```
DELETE /api/training-programs/:id
```

限制：只有 DRAFT 状态可以删除。

#### 2.1.6 状态变更

```
PUT /api/training-programs/:id/status
Body: { "status": "ENROLLING" }
```

状态流转规则：
- DRAFT → ENROLLING（开放报名）
- ENROLLING → IN_PROGRESS（开班，开始上课）
- IN_PROGRESS → FINISHED（结课）
- 任何状态 → CANCELLED

#### 2.1.7 批量报名

```
POST /api/training-programs/:id/enroll
Body: { "studentIds": [1, 2, 3], "agencyId": null }
```

批量添加学员报名记录。如果已有学员存在则跳过（不报错）。agencyId 可选，传 null 表示协会直招。

返回：{ "enrolled": 3, "skipped": 0, "total": 3 }

### 2.2 新增 EnrollmentAgencyModule

新建文件：
- `server/src/modules/enrollment-agencies/enrollment-agencies.module.ts`
- `server/src/modules/enrollment-agencies/enrollment-agencies.controller.ts`
- `server/src/modules/enrollment-agencies/enrollment-agencies.service.ts`

控制器路径：`api/enrollment-agencies`

#### 2.2.1 列表

```
GET /api/enrollment-agencies?keyword=&page=1
```
返回：{ items: [...], total }

字段：id, name, shortName, contactPerson, contactPhone, totalEnrolled, isActive

#### 2.2.2 创建

```
POST /api/enrollment-agencies
Body: { "name": "北京XX咨询有限公司", "shortName": "北京XX", "contactPerson": "张三", "contactPhone": "138xxxx" }
```

#### 2.2.3 更新/删除

```
PUT /api/enrollment-agencies/:id
DELETE /api/enrollment-agencies/:id
```

### 2.3 修改 ExamsController

#### 2.3.1 创建考试时关联培训班

修改 `POST /api/exams` 的 body 增加可选字段：
```
"programId": 1
```

如果传了 programId，自动将该培训班的学员设为此考试的考生（覆盖原来的"所有学员"逻辑）。

#### 2.3.2 考试详情增加 program 信息

修改 `GET /api/exams/:id` 的 include，增加：
```json
"program": { "select": { "id": true, "name": true, "courseName": true, "code": true } }
```

#### 2.3.3 考试列表增加 program 信息

修改 `GET /api/exams` 的 include，增加：
```json
"program": { "select": { "id": true, "name": true, "code": true } }
```

#### 2.3.4 更新考试增加考试规则字段

修改 `PUT /api/exams/:id` 支持以下字段：
```
isOpenBook, openBookRules, lateEntryMinutes, earlyExitMinutes, passingScore
```

### 2.4 修改 GradingController

#### 2.4.1 阅卷列表增加 scoreBreakdown

修改 `GET /api/grading/:examId` 返回的 session 对象增加：
```json
{
  "scoreBreakdown": {
    "SINGLE_CHOICE": { "total": 40, "earned": 32, "count": 20, "correct": 16 },
    "TRUE_FALSE": { "total": 10, "earned": 8, "count": 10, "correct": 8 },
    "SHORT_ANSWER": { "total": 20, "earned": 15, "count": 2, "correct": 0 },
    "CASE_STUDY": { "total": 20, "earned": 16, "count": 1, "correct": 0 }
  }
}
```

#### 2.4.2 评分后计算 scoreBreakdown

修改 `PUT /api/grading/:examId/:studentId/:answerId` 的 gradeAnswer 方法。

每次评分后重新计算该学员的 scoreBreakdown：
1. 遍历 ExamAnswer 的所有答案
2. 根据 PaperQuestion 关联的 Question.type 分组
3. 客观题：已由自动判分填入 score 和 isCorrect
4. 主观题：score 由人工填入
5. 按题型汇总 scoreBreakdown JSON

更新 ExamSession 的 scoreBreakdown 字段。

#### 2.4.3 成绩发布自动创建证书草稿

修改 `POST /api/grading/:examId/publish`。发布成绩时，自动做以下操作：

1. 检查该考试是否关联了培训班（exam.programId）
2. 如果有关联培训班，且学员 passed=true，自动创建 Certificate 草稿
3. 状态 approvalStatus = 'DRAFT'，不正式发证
4. 同时记录 CertificateApprovalLog action='CREATE'

返回增加字段：
```json
{
  "success": true,
  "message": "成绩已发布",
  "certDraftCount": 5,
  "programId": 1
}
```

### 2.5 修改 CertificatesController

#### 2.5.1 列表增加审批状态筛选

```
GET /api/certificates?page=1&limit=20&status=DRAFT&examSessionId=&studentId=&keyword=
```

新增 status 参数（对应 approvalStatus）。keyword 搜索 studentName / certificateNo。

返回 items 增加字段：
```json
{
  "approvalStatus": "DRAFT",
  "approvalStatusLabel": "草稿",
  "approvedBy": null,
  "approvedAt": null,
  "rejectReason": null
}
```

#### 2.5.2 证书审批

```
POST /api/certificates/:id/approve
Body: { "approvedBy": 1 }
```
- 状态：DRAFT → APPROVED
- 记录 CertificateApprovalLog
- 设置 approvedBy, approvedAt

#### 2.5.3 证书驳回

```
POST /api/certificates/:id/reject
Body: { "reviewedBy": 1, "reason": "成绩未达标" }
```
- 状态：DRAFT → REJECTED（或 PENDING → REJECTED）
- 记录 CertificateApprovalLog

#### 2.5.4 批量审批

```
POST /api/certificates/batch-approve
Body: { "ids": [1, 2, 3], "approvedBy": 1 }
```

#### 2.5.5 证书申请（学员端）

```
POST /api/certificates/apply
Body: { "sessionId": 1, "studentId": 1, "applyNote": "请发证书" }
```
- 创建 CertificateApplication
- 如果还没有 Certificate 草稿，自动创建（approvalStatus='DRAFT'）

#### 2.5.6 证书申请列表（管理端）

```
GET /api/certificates/applications?status=PENDING&page=1
```
返回 CertificateApplication 列表。

#### 2.5.7 审核证书申请

```
POST /api/certificates/applications/:id/review
Body: { "action": "APPROVE", "reviewedBy": 1, "reviewNote": "同意发证" }
```
- action: APPROVE / REJECT
- approve 时如果该 session 还没有正式证书，创建 Certificate（approvalStatus='APPROVED' 直接从审批通过发证）
- reject 时更新 CertificateApplication.status='REJECTED'

#### 2.5.8 考试成绩单（新接口）

```
GET /api/exams/:examId/transcript
```

```
GET /api/exams/:examId/transcript?format=csv
```

返回该场考试所有已提交学员的成绩单，含分题型明细。

```json
{
  "exam": { "id": 1, "title": "DTC考试" },
  "program": { "id": 1, "name": "DTC2026第一期", "courseName": "..." },
  "students": [
    {
      "studentId": 5,
      "displayName": "张三",
      "organization": "北京XX公司",
      "totalScore": 82,
      "isPassed": true,
      "scoringStatus": "PUBLISHED",
      "scoreBreakdown": {
        "SINGLE_CHOICE": { "total": 40, "earned": 32, "count": 20, "correct": 16 },
        "TRUE_FALSE": { "total": 10, "earned": 8, "count": 10, "correct": 8 },
        "SHORT_ANSWER": { "total": 20, "earned": 15, "count": 2, "correct": 0 },
        "CASE_STUDY": { "total": 20, "earned": 16, "count": 1, "correct": 0 }
      },
      "submittedAt": "2026-03-31T15:00:00.000Z"
    }
  ],
  "summary": {
    "totalStudents": 45,
    "submittedCount": 42,
    "passedCount": 38,
    "avgScore": 78.5,
    "maxScore": 96,
    "minScore": 45
  }
}
```

format=csv 时返回 CSV 文件下载（Content-Type: text/csv）。
CSV 表头：序号, 学员姓名, 单位, 单选(40), 判断(10), 填空(10), 简答(10), 案例(20), 总分, 是否通过, 提交时间

### 2.6 修改 StudentExamController

现有的学员端考试接口不动。确认 `GET /api/exam/result/:id` 返回是否包含 scoreBreakdown。

如果已有返回，确认字段名一致。如果没有，修改 ExamSession 的 result 返回增加 scoreBreakdown。

### 2.7 新增权限常量

在 `server/src/common/permissions.constants.ts` 中新增：

```
PROGRAM_VIEW        = 'program:view'
PROGRAM_CREATE      = 'program:create'
PROGRAM_EDIT        = 'program:edit'
PROGRAM_DELETE      = 'program:delete'
PROGRAM_ENROLL      = 'program:enroll'
AGENCY_VIEW         = 'agency:view'
AGENCY_CREATE       = 'agency:create'
AGENCY_EDIT         = 'agency:edit'
AGENCY_DELETE       = 'agency:delete'
CERT_APPROVE        = 'cert:approve'
CERT_REJECT         = 'cert:reject'
CERT_APPLICATION_VIEW = 'cert:application_view'
TRANSCRIPT_VIEW     = 'transcript:view'
```

### 2.8 AppModule 注册

修改 `server/src/app.module.ts`，新增：
- TrainingProgramsModule
- EnrollmentAgenciesModule

---

## PART 3: 前端页面变更

### 3.1 新页面：培训班管理（programs）

新建以下文件：

```
client/src/app/programs/page.tsx          -- 培训班列表
client/src/app/programs/new/page.tsx       -- 新建培训班
client/src/app/programs/[id]/page.tsx      -- 培训班详情
client/src/app/programs/[id]/edit/page.tsx -- 编辑培训班
```

#### 3.1.1 programs/page.tsx（培训班列表）

**页面路径**：`/programs`

**布局**：AppLayout 包裹

**功能**：
1. 顶部标题 "📋 培训班管理" + 副标题 "培训班级 · 招生报名 · 考试关联"
2. 统计卡片行（3个）：进行中 N 个、本月开班 N 个、全部 N 个
3. 搜索框 + 状态筛选（全部/草稿/报名中/进行中/已结课）
4. 表格/卡片列表

**列表每行/卡片字段**：

| 字段 | 显示 | 说明 |
|------|------|------|
| 编号 | `{code}` | 统一业务编号 |
| 名称 | `{name}` | 培训班名称 |
| 科目 | `{subject.name}` | DTC/DTM/DTGV |
| 时间段 | `{startDate} ~ {endDate}` | 开班~结课 |
| 报名状态 | 标签：报名中/未开始/已截止 | 根据 enrollStart/enrollEnd 和当前时间计算 |
| 状态 | 标签：草稿/报名中/进行中/已结课/已取消 | status 字段 |
| 学员数 | `{enrolledCount}/{maxStudents}` | 已报名/限额 |
| 操作 | 详情 / 编辑 / 删除 | 权限控制 |

**交互**：
- 点击行进入详情页 `/programs/[id]`
- 新建按钮跳转 `/programs/new`
- 状态变更用 dropdown 菜单（草稿→报名中，报名中→进行中，进行中→已结课）

**数据加载**：
```typescript
const [programs, setPrograms] = useState<any[]>([]);
const [keyword, setKeyword] = useState('');
const [filterStatus, setFilterStatus] = useState('');
// GET /api/training-programs?keyword=&status=&page=1
```

#### 3.1.2 programs/new/page.tsx（新建培训班）

**表单字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | input | 是 | 培训班名称，如"DTC2026第二期" |
| courseName | input | 是 | 课程全称，如"DT+人才培育体系咨询师（DTC）培训" |
| subjectId | select | 是 | 科目选择，从 DataDictionary 列表加载 |
| startDate | date picker | 是 | 开班日期 |
| endDate | date picker | 是 | 结课日期 |
| enrollStart | date picker | 是 | 报名开始日期 |
| enrollEnd | date picker | 是 | 报名截止日期 |
| tuitionFee | input (number) | 否 | 培训费 |
| examFee | input (number) | 否 | 考试费 |
| certFee | input (number) | 否 | 证书费 |
| maxStudents | input (number) | 否 | 限额人数 |
| headTeacher | input | 否 | 班主任 |
| location | input | 否 | 培训地点 |
| description | textarea | 否 | 培训说明 |

**验证规则**：
- startDate < endDate
- enrollStart < enrollEnd
- enrollStart > 当前时间（报名不能在过去）
- name 和 courseName 不能为空
- subjectId 不能为空
- maxStudents > 0（如果填写）

**保存逻辑**：
```typescript
// POST /api/training-programs
// 成功后跳转到 /programs/[id]
```

#### 3.1.3 programs/[id]/page.tsx（培训班详情）

**页面路径**：`/programs/[id]`

**顶部区域**：
- 标题：`{code} {name}`
- 状态标签 + 操作按钮（根据状态显示）
  - DRAFT → 开放报名 / 编辑 / 删除
  - ENROLLING → 开班 / 编辑
  - IN_PROGRESS → 结课
  - FINISHED → 无操作
  - 任何状态 → 取消
- 基本信息卡片

**基本信息卡片字段**：

| 字段 | 显示 |
|------|------|
| 课程全称 | `{courseName}` |
| 科目 | `{subject.name}` |
| 时间 | `{startDate} ~ {endDate}` |
| 报名时间 | `{enrollStart} ~ {enrollEnd}` |
| 费用 | 培训费 ¥{tuitionFee} / 考试费 ¥{examFee} / 证书费 ¥{certFee} |
| 人数 | `{enrolledCount}/{maxStudents}` |
| 地点 | `{location}` |
| 班主任 | `{headTeacher}` |
| 描述 | `{description}` |

**Tab 切换**：学员名单 | 考试 | 成绩单 | 证书

**Tab 1 - 学员名单**：
- 显示所有已报名学员列表
- 表格字段：姓名、手机、单位、来源、缴费状态、报名时间、操作（退学/退费）
- 添加学员按钮 → 弹窗搜索学员 + 批量添加
- 如果有关联招生机构，显示机构名称列

**Tab 2 - 考试**：
- 显示该培训班关联的考试列表
- 表格字段：考试名称、试卷、考试时间、状态、提交人数
- 点击进入 `/exams/[id]`
- 新建考试按钮 → 跳转 `/exams/create?programId=[id]`

**Tab 3 - 成绩单**：
- 显示该培训班所有考试的成绩汇总
- 调用 `GET /api/exams/:examId/transcript`
- 如果该培训班有多场考试，用考试选择器切换
- 表格字段：序号、姓名、单位、各题型得分...、总分、是否通过
- 导出 CSV 按钮（`GET /api/exams/:examId/transcript?format=csv`）
- 打印按钮（直接 window.print）

**Tab 4 - 证书**：
- 显示该培训班证书列表
- 直接跳转 `/certificates?programId=[id]`

#### 3.1.4 programs/[id]/edit/page.tsx（编辑培训班）

同新建表单，预填现有数据。
PUT /api/training-programs/:id

### 3.2 新页面：招生机构管理

新建：
```
client/src/app/agencies/page.tsx
client/src/app/agencies/new/page.tsx
client/src/app/agencies/[id]/page.tsx
client/src/app/agencies/[id]/edit/page.tsx
```

#### 3.2.1 agencies/page.tsx（招生机构列表）

**页面路径**：`/agencies`

**功能**：
1. 标题 "🏢 招生机构管理" + 副标题 "合作机构 · 招生统计"
2. 搜索框（按名称/联系人搜索）
3. 表格：序号、机构名称、简称、联系人、联系电话、招生人数、状态（启用/停用）、操作

#### 3.2.2 agencies/new/page.tsx（新建招生机构）

**表单字段**：name(必填), shortName, contactPerson, contactPhone, contactEmail, remark

### 3.3 修改考试创建页面

编辑 `client/src/app/exams/create/page.tsx`

**新增字段**：

1. **关联培训班** - Select 下拉框
   - 从 `/api/training-programs?status!=CANCELLED&pageSize=100` 加载
   - 可选（不选则为独立考试，不绑定任何培训班）
   - 选培训班后，该培训班的学员会自动设为考生
   - 如果有 URL 参数 `programId` 则自动选中

2. **是否为开卷考试** - 开关/复选框
   - 默认从试卷模板的 isOpenBook 继承
   - 可手动覆盖

3. **开卷规则说明** - textarea
   - 仅在 isOpenBook=true 时显示
   - 示例："允许携带纸质参考资料，禁止使用电子设备"

4. **迟到禁止入场** - input (number) 分钟
   - 可选，默认空（不限制）
   - 如填 15，则开考后 15 分钟禁止入场

5. **提前交卷限制** - input (number) 分钟
   - 可选，默认空（随时可交）
   - 如填 30，则开考后 30 分钟方可交卷
   - 如填 0，则为全程不可提前交卷

6. **通过分数线** - input (number) 分
   - 可选，默认空（按试卷总分的 60% 计算）

### 3.4 修改考试详情页

编辑 `client/src/app/exams/[id]/page.tsx`

**新增显示字段**（在基本信息区）：

1. 关联培训班（如果有）→ 显示名称，可点击跳转
2. 开卷/闭卷标签 + 开卷规则（以提示框形式展示）
3. 迟到禁止 + 提前交卷限制
4. 通过分数线

**增加底部操作按钮**：
- 如果 status=FINISHED，增加「成绩单」按钮 → `/exams/[id]/transcript`
- 如果 status=FINISHED，增加「发证」按钮 → 跳转到证书页 `?examId=[id]`

### 3.5 新页面：考试成绩单

新建：
```
client/src/app/exams/[id]/transcript/page.tsx
```

**页面路径**：`/exams/[id]/transcript`

**功能**：
1. 标题：`{exam.title} - 成绩单`
2. 统计概览行：参考人数、提交人数、通过人数、平均分、最高分、最低分
3. 表格（核心）：

| 序号 | 学员姓名 | 单位 | 单选(40) | 判断(10) | 填空(10) | 简答(10) | 案例(20) | 总分 | 是否通过 | 状态 | 提交时间 |
|------|----------|------|---------|---------|---------|---------|---------|------|---------|------|---------|

- 题型列和题型满分根据试卷实际题型动态生成
- 状态：成绩状态（已发布/待发布/待阅卷）

4. 操作按钮：导出CSV、打印

**数据来源**：`GET /api/exams/:examId/transcript`

### 3.6 修改证书管理页

编辑 `client/src/app/certificates/page.tsx`

**新增功能**：

1. **筛选栏**：
   - 审批状态筛选：全部/草稿/待审批/已通过/已驳回/已撤销
   - 搜索框（证书编号/学员姓名）
   - 培训班筛选（可选）

2. **表格新增列**：
   | 字段 | 显示 |
   |------|------|
   | 审批状态 | 标签：草稿/待审批/已通过/已驳回/已撤销 |
   | 审批人 | 如已审批显示姓名 |
   | 审批时间 | 如已审批显示时间 |
   | 驳回原因 | 如已驳回显示 |

3. **操作按钮**：
   - 草稿状态：审核通过 / 驳回
   - 已通过状态：撤销 / PDF下载 / 查看
   - 已撤销状态：显示撤销原因

4. **批量操作**：
   - 多选 + 批量通过（全选或勾选）
   - `POST /api/certificates/batch-approve`

5. **顶部统计卡片**：待审批 N 份、待发放 N 份、已撤销 N 份
6. 增加「证书申请」Tab（跳转到申请列表页或内嵌列表）

### 3.7 新页面：证书申请管理

新建：
```
client/src/app/certificates/applications/page.tsx
```

**页面路径**：`/certificates/applications`

**功能**：
1. 标题 "📝 证书申请管理" + 副标题 "学员发起的证书申请 · 审核处理"
2. 统计卡片：待审核 N、已通过 N、已驳回 N
3. 状态筛选：全部/待审核/已通过/已驳回
4. 列表表格：

| 序号 | 学员姓名 | 考试/培训班 | 申请时间 | 状态 | 操作 |
|------|----------|------------|---------|------|------|
| 1 | 张三 | DTC考试 | 2026-04-01 | 待审核 | 通过 / 驳回 |

5. 审核弹窗：填写审核意见 + 通过/驳回按钮

### 3.8 修改阅卷页

编辑 `client/src/app/grading/[examId]/page.tsx`

**新增显示**：

1. 学员列表中每行显示 scoreBreakdown 简况（高分/低分可通过颜色标记）
2. 学员详情页（选中后）增加 scoreBreakdown 汇总卡，显示分题型得分：

```
┌────────────────────────────────────────────┐
│  成绩汇总                                  │
│  ┌─────────┬────────┬──────┬────────┐     │
│  │ 题型    │ 得分   │ 满分 │ 得分率 │     │
│  ├─────────┼────────┼──────┼────────┤     │
│  │ 单选    │ 32     │ 40   │ 80%    │     │
│  │ 判断    │ 8      │ 10   │ 80%    │     │
│  │ 填空    │ 7      │ 10   │ 70%    │     │
│  │ 简答    │ 15     │ 20   │ 75%    │ ✓   │ ← 正在评分
│  │ 案例    │ 16     │ 20   │ 80%    │ ✓   │
│  ├─────────┼────────┼──────┼────────┤     │
│  │ 总分    │ 78     │ 100  │ 78%    │     │
│  └─────────┴────────┴──────┴────────┘     │
│  通过分数线: 60分  ✅ 已通过               │
└────────────────────────────────────────────┘
```

### 3.9 修改学员详情页

编辑 `client/src/app/students/[id]/page.tsx`

**在考试历史 Tab 中增加显示**：
- 每场考试显示 scoreBreakdown（如果有）
- 显示成绩单链接（如果已发布）

### 3.10 修改导航侧边栏

编辑 `client/src/components/sidebar.tsx`

**新增导航项**：

```javascript
{ path: '/programs', label: '培训班管理', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
{ path: '/agencies', label: '招生机构', icon: '🏢', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
```

在「考试管理」和「阅卷中心」之间插入「培训班管理」。
「招生机构」放在「学员管理」之后或作为二级入口？

**建议顺序**（从高频到低频）：
1. 工作台
2. 个人中心
3. 题库管理
4. 试卷管理
5. 考试管理
6. **培训班管理** (NEW)
7. 阅卷中心
8. **成绩单** (NEW) - 或者作为考试管理的子页面
9. 证书管理
10. **证书申请** (NEW) - 或者作为证书管理的子页面
11. 学员管理
12. **招生机构** (NEW)
13. 教材出题
14. 账户管理
15. 权限管理
16. 系统设置

### 3.11 前端 api.ts 扩展

在 `client/src/lib/api.ts` 中新增：

```typescript
// 培训班
trainingPrograms: {
  list: (params?: Record<string, string>) => { /* GET /api/training-programs */ },
  get: (id: number) => { /* GET /api/training-programs/:id */ },
  create: (data: any) => { /* POST /api/training-programs */ },
  update: (id: number, data: any) => { /* PUT /api/training-programs/:id */ },
  delete: (id: number) => { /* DELETE /api/training-programs/:id */ },
  updateStatus: (id: number, status: string) => { /* PUT /api/training-programs/:id/status */ },
  enrollStudents: (id: number, data: { studentIds: number[]; agencyId?: number }) => { /* POST /api/training-programs/:id/enroll */ },
},

// 招生机构
agencies: {
  list: (params?: Record<string, string>) => { /* GET /api/enrollment-agencies */ },
  get: (id: number) => { /* GET /api/enrollment-agencies/:id */ },
  create: (data: any) => { /* POST /api/enrollment-agencies */ },
  update: (id: number, data: any) => { /* PUT /api/enrollment-agencies/:id */ },
  delete: (id: number) => { /* DELETE /api/enrollment-agencies/:id */ },
},

// 证书审批扩展
certificates: {
  // ...保留现有
  approve: (id: number, data: { approvedBy: number }) => { /* POST /api/certificates/:id/approve */ },
  reject: (id: number, data: { reviewedBy: number; reason: string }) => { /* POST /api/certificates/:id/reject */ },
  batchApprove: (data: { ids: number[]; approvedBy: number }) => { /* POST /api/certificates/batch-approve */ },
  applications: (params?: Record<string, string>) => { /* GET /api/certificates/applications */ },
  reviewApplication: (id: number, data: { action: string; reviewedBy: number; reviewNote?: string }) => { /* POST /api/certificates/applications/:id/review */ },
  apply: (data: { sessionId: number; studentId: number; applyNote?: string }) => { /* POST /api/certificates/apply */ },
},

// 成绩单
exams: {
  // ...保留现有
  transcript: (examId: number) => { /* GET /api/exams/:examId/transcript */ },
  transcriptCsv: (examId: number) => { /* URL string for download */ },
},
```

---

## PART 4: 实施顺序（分步执行）

建议 Claude Code 按以下顺序实施，每一步完成后验证再继续下一步：

### Step 1: Prisma Schema
- 新增所有 model（TrainingProgram, EnrollmentAgency, ProgramEnrollment, CertificateApplication, CertificateApprovalLog）
- 修改 Exam, ExamSession, Certificate
- 执行 `npx prisma db push`

### Step 2: 后端 - 培训班 API
- TrainingProgramsModule（controller + service）
- CRUD + 状态变更 + 批量报名
- 权限常量 + 装饰器
- 注册到 AppModule
- 验证：curl 测试所有端点

### Step 3: 后端 - 招生机构 API
- EnrollmentAgenciesModule
- CRUD
- 注册到 AppModule

### Step 4: 后端 - 考试 + 阅卷改造
- 修改 ExamsController（关联培训班、考试规则字段）
- 修改 GradingController（scoreBreakdown 计算 + 存储）
- 成绩发布自动创建证书草稿
- 新增 transcript 接口

### Step 5: 后端 - 证书审批 API
- 修改 CertificatesController
- 审批/驳回/批量审批
- 证书申请接口

### Step 6: 前端 - 培训班页面
- programs/page.tsx（列表）
- programs/new/page.tsx（新建）
- programs/[id]/page.tsx（详情）
- programs/[id]/edit/page.tsx（编辑）
- api.ts 扩展

### Step 7: 前端 - 招生机构页面
- agencies/page.tsx
- agencies/new/page.tsx
- agencies/[id]/page.tsx
- agencies/[id]/edit/page.tsx

### Step 8: 前端 - 考试创建/详情改造
- 修改 exams/create/page.tsx（关联培训班、考试规则）
- 修改 exams/[id]/page.tsx（显示培训班、开卷规则等）

### Step 9: 前端 - 成绩单 + 阅卷改造
- 新建 exams/[id]/transcript/page.tsx
- 修改 grading/[examId]/page.tsx（scoreBreakdown 显示）

### Step 10: 前端 - 证书审批改造
- 修改 certificates/page.tsx
- 新建 certificates/applications/page.tsx

### Step 11: 导航 + 权限
- 修改 sidebar.tsx
- 检查权限装饰器覆盖

---

## PART 5: 注意事项

### 5.1 关键业务规则

1. **自动编号**：TrainingProgram.code 格式 `DT-TC-{YYYY}-{NNN}`，NNN 从 001 递增。同一年的归零。
2. **跨年处理**：如今年编码到 DT-TC-2026-045，明年从 DT-TC-2027-001 重新开始。
3. **证书草稿自动创建**：只在「关联了培训班的考试」中，成绩发布时对通过学员自动创建证书草稿。独立考试不发草稿证书。
4. **证书编号规则不变**：现有 `FX-{日期}-{流水号}` 逻辑不动。
5. **成绩状态机不动**：PENDING→GRADING→GRADED→PUBLISHED→ADJUSTED→PUBLISHED，只加 scoreBreakdown 字段。

### 5.2 兼容性

1. 现有独立考试（无 programId）完全不受影响
2. 现有证书（无 approvalStatus）默认为 "APPROVED"（已发证），保持兼容
3. StudentGroup 保留现有逻辑，不与 TrainingProgram 混用
4. 所有新增字段在 Prisma 层都是 optional/nullable，不影响已有数据

### 5.3 测试场景

实施完成后需要验证以下场景：

1. **新建培训班** → 设置科目、时间、费用 → 改为 ENROLLING
2. **报名** → 添加学员到培训班 → 检查 enrolledCount 更新
3. **关联考试** → 新建考试时选培训班 → 考生自动来自培训班 → 发布考试
4. **考试 + 阅卷** → 学员提交 → 客观题自动判分 → 人工评主观题 → 发布成绩
5. **证书草稿** → 发布成绩后自动生成证书草稿 → 去证书管理查看
6. **证书审批** → 审批通过 → 查看证书状态变为 "已通过"
7. **成绩单** → 查看分题型成绩 → 导出 CSV

---

*此作业单由小狐狸（FoxLearn 架构师）编制，转交 Claude Code 执行。*
*执行过程中如有疑问请及时反馈，不要自行假设。*
