# FoxLearn 考试与阅卷模块 — 二期实施指令

> 给 Claude Code 的完整指令。请按照本文档的顺序和范围实现，不要提前做未指定的泛化设计。

---

## 一、设计总纲

### 核心抽象（考试 ≠ 场次）

```
考试模板 (Exam) → 多个考试场次 (ExamSession) → 学员参加 → 答卷 → 阅卷 → 发布成绩 → 证书
```

- **考试模板**：定义题目、时长、通过分等
- **考试场次**：某时间某班某次实际考试，可重复使用同一模板
- 一个考试场次对应一次真实考试

### 二期只做模式一（SINGLE）

SINGLE 模式定义：
- 培训班 → 上课 → 一次考试 → 过线可发证
- 补考：次数+时间范围可配置
- 无多科依赖、无有效期，过线即过

---

## 二、二期范围（精确边界）

### ✅ 做

| 模块 | 内容 |
|------|------|
| 阅卷评分 | 现有 grading controller + 前端阅卷中心，修补优化 |
| 客观题自动判分 | 交卷时单选题/多选题/判断题自动算分 |
| 成绩发布 | 阅卷完成 → 发布 → 学员可见 |
| 成绩调整+审计 | ScoreAdjustmentLog 表 + 权限控制 |
| 证书（简化版） | 手动发证 + PDF + 编号 + 防伪码 |

### ❌ 不做（列入三期规划）

| 模块 | 原因 |
|------|------|
| CertificateRule 泛化表 | SINGLE 模式不需要规则引擎，Exam 自带字段足够 |
| 四种考试模式规则引擎 | 等需要 SEPARATE/BUNDLED/SEQUENTIAL 时再抽象 |
| 培训班课程结构 | StudentGroup 作为临时替代够用 |
| 证书公开查询页 | 数据模型预留，UI 等三期 |
| 批量评分 | 二期先支持逐题评分 |

---

## 三、当前代码现状（不需要改动的基础）

### 已有的后端
- ✅ `grading.controller.ts` — 五个接口完整（见下文详细检查）
- ✅ `ScoreAuditLog` 模型已存在于 schema
- ✅ 权限点定义完整（`GRADING_MANUAL`, `GRADING_PUBLISH`, `GRADING_AUTO`）

### 已有的前端
- ✅ `client/src/app/grading/page.tsx` — 阅卷中心列表页
- ✅ `client/src/app/grading/[examId]/page.tsx` — 逐题评分、成绩调整页面
- ✅ 侧边栏已有 "阅卷中心" 入口

---

## 四、Prisma Schema 修改（按顺序执行）

### 4.1 Exam 表加字段

```prisma
model Exam {
  // ...现有字段不变

  passingScore    Float?    // 通过分数线，null=不设分数线
  maxRetakeAttempts Int?    // 最大补考次数，null=不限
  retakeWindowDays Int?     // 补考时间窗口（天），null=不限
}
```

迁移脚本：项目用 `prisma db push`（`prisma/migrations/` 为空目录，无初始 migration）。先 `prisma db push` 推 schema 变更；如果报错，先 `prisma db pull` 拉取当前数据库结构作基线，再加字段。

### 4.2 新增 Certificate 模型

```prisma
model Certificate {
  id                Int      @id @default(autoincrement())
  examSessionId     Int      // 关联考试场次
  studentId         Int      // 关联学员
  certificateNo     String   @unique @db.VarChar(64) // 唯一证书编号
  studentName       String   @db.VarChar(100)        // 冗余，查询无需登录
  courseName        String   @db.VarChar(200)        // 冗余
  issueDate         DateTime @default(now())
  isRevoked         Boolean  @default(false)
  revokedAt         DateTime?
  revokeReason      String?  @db.Text
  verificationCode  String   @unique @db.VarChar(128) // 防伪码/查询码
  metadata          Json?    // 扩展信息（考试成绩、证书模板版本等）
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  examSession ExamSession @relation(fields: [examSessionId], references: [id])
  student     User        @relation(fields: [studentId], references: [id])

  @@index([examSessionId])
  @@index([studentId])
  @@map("certificates")
}
```

### 4.3 新增 CertificateVerificationLog 模型（可选但建议建）

```prisma
model CertificateVerificationLog {
  id              Int      @id @default(autoincrement())
  certificateId   Int
  queryType       String   // PUBLIC（公开查询）| ADMIN（后台查看）
  queriedAt       DateTime @default(now())
  ipAddress       String?  @db.VarChar(45)
  userAgent       String?  @db.Text

  certificate Certificate @relation(fields: [certificateId], references: [id])

  @@index([certificateId])
  @@map("certificate_verification_logs")
}
```

### 4.4 阅卷状态字段（在 ExamSession 上加 scoringStatus）

**⚠️ 模型叫 `ExamSession`，不是 `ExamSessionStudent`。** 当前 `ExamSession` 已有 `status` 字段（值域 `ASSIGNED | ACTIVE | PAUSED | SUBMITTED`），这是**考试参与流程**（分配→开始考试→暂停→交卷）。阅卷流程需要**独立的字段**，不要混用：

```prisma
model ExamSession {
  // ...现有字段（id, examId, studentId, status, totalScore, subjectiveScore, finalScore, isPassed 等）不变

  scoringStatus        String?   @default("PENDING") // PENDING | GRADING | GRADED | ADJUSTED | PUBLISHED
  // PENDING:   已交卷，客观题已自动判完，等待主观题阅卷
  // GRADING:   有主观题正在被评分（至少一个已评，但不是全部）
  // GRADED:    所有题目（含主观题）已评分完毕，等待发布
  // ADJUSTED:  发布后被人为调整了成绩，需重新发布
  // PUBLISHED: 成绩已对学员可见

  scoringPublishedAt DateTime?  @map("scoring_published_at")
}
```

`ExamSession.status` 保持不变（`ASSIGNED → ACTIVE → PAUSED → SUBMITTED`）。阅卷进度通过 `scoringStatus` 独立追踪。

### 4.5 状态转移规则（在 `scoringStatus` 上实现，不是 `ExamSession.status`）

⚠️ **区分清楚：** `ExamSession.status` 是考试参与流程（`ASSIGNED → ACTIVE → PAUSED → SUBMITTED`），**不要改动它**。阅卷流程使用独立的 `scoringStatus` 字段：

```
学员交卷（submitExam）
    → scoringStatus = PENDING
    → 客观题由 autoGrade() 自动判分（已有逻辑，不需要重写）

所有客观题判完后
    → scoringStatus 仍是 PENDING（等主观题阅卷）

第一个主观题被评分（gradeAnswer endpoint）
    → scoringStatus = GRADING（grading controller 自动更新）

最后一个主观题被评分
    → scoringStatus = GRADED（所有题已评完，等待发布）

管理员调用 publish 接口
    → scoringStatus = PUBLISHED
    → scoringPublishedAt = now()

成绩发布后被调整（adjust endpoint）
    → scoringStatus = ADJUSTED（从 PUBLISHED 变为 ADJUSTED）
    → 调整记录记入 ScoreAuditLog
    → 需要再次调用发布 → scoringStatus = PUBLISHED
```

---

## 五、后端 API 补充

### 5.1 现有接口检查确认

- [ ] `GET /api/grading/:examId` — 列表返回的学员，过滤掉 ABSENT（缺考）
- [ ] `PUT /api/grading/:examId/:studentId/:answerId` — 评分时检查：如果这是最后一个待评主观题，自动更新 `ExamSession.scoringStatus = GRADED`
- [ ] `POST /api/grading/:examId/publish` — 发布前检查：
  - 所有已提交学员的所有主观题是否已评完
  - 有未评完的学员，返回具体名单，拒绝发布
  - **发布时不仅要校验，还要真正更新数据库**（设 `scoringStatus = PUBLISHED`, `scoringPublishedAt = now()`）
- [ ] `POST /api/grading/:examId/:studentId/adjust` — 调整时 update `ExamSession.scoringStatus = ADJUSTED`，状态从 PUBLISHED 变回 ADJUSTED（需重新发布）

### 5.1.1 ⚠️ 现有代码中的 bug（必须先修再增）

以下是为 Claude Code 的代码审查发现，必须在开始二期新增功能前修复：

**① passingScore 硬编码在 3 处（优先级：高）**
- `grading.controller.ts` 约第 149 行和第 218 行：`totalScore * 0.6` 或 `score >= totalScore * 0.6`
- `exams.service.ts` 约第 489 行（autoGrade 方法内）
- **修复方式**：全部改为 `exam.passingScore ?? Math.floor(totalScore * 0.6)`，从 Exam 表的 `passingScore` 字段取值，null 时才回退到 60%

**② 主观题判断逻辑有误（优先级：高）**
- `grading.controller.ts` `gradeAnswer()` 中用 `isCorrect === null` 来识别主观题 — 这不正确
- 客观题（选择题、判断题）自动判完时 `isCorrect` 已经设值为 `true/false`
- 但填空题也走了 autoGrade，某些场景下 `isCorrect` 已设值，用 `isCorrect === null` 会漏判
- **修复方式**：改为 `question.type === 'SHORT_ANSWER' || question.type === 'ESSAY'` 或其他主观题型判断

**③ publishResults 只校验不更新（优先级：高）**
- `grading.controller.ts` `publishResults()` 方法：遍历校验了所有主观题是否已评完，校验失败时返回 400 并列出未评完的学员
- **但校验通过后没有写数据库** — 没有更新 `scoringStatus = PUBLISHED`，没有设 `scoringPublishedAt`
- 返回 200 success 后数据库状态根本没变
- **修复方式**：校验通过后，用 Prisma transaction 批量更新所有已提交学员的 `scoringStatus = 'PUBLISHED'` 和 `scoringPublishedAt = new Date()`

**④ 客观题自动判分 autoGrade 已存在（优先级：中）**
- `exams.service.ts` 第 404–492 行已实现 `autoGrade(examSessionId)` 方法
- 选择题（单选/多选）、判断题自动判分逻辑完整
- 填空题也部分支持（字符串匹配）
- **影响**：本期 Step 3（客观题自动判分）大部分已完成，不需要重写。只需：
  - 确认 `autoGrade` 在交卷时被调用（检查 `submitExam` 流程）
  - 将 `passingScore` 硬编码改为从 `exam.passingScore` 取值（见上面①）
  - 确认 `scoringStatus` 初始化为 `PENDING`

**⑤ 迁移策略：用 `prisma db push` 不是 `prisma migrate dev`（优先级：中）**
- 项目 `prisma/migrations/` 目录为空，从未创建过初始 migration
- 直接用 `prisma migrate dev --name init` 会失败（MySQL 已有表但没有 migration 记录）
- **修复方式**：用 `prisma db push` 推 schema 变更（Prisma 自动 diff 现有表结构）
- 如果 `db push` 报错，先 `prisma db pull` 拉取当前数据库结构生成 schema 基线，再加字段

#### 证书生成（手动发证）

```
POST /api/certificates
Body: { examSessionId, studentIds: number[] }
Res:  { certificates: { id, certificateNo, ... }[] }
```

逻辑：
- 检查这些学员在该考试场次中是否已 PUBLISHED
- 检查这些学员是否已有证书（防止重复发证）
- 生成唯一证书编号（规则见下文）
- 生成唯一防伪码（32位随机字符串）
- 批量创建 Certificate 记录
- 返回证书列表

#### 单个证书生成

```
POST /api/certificates/:examSessionId/:studentId
Body: {}
Res:  { certificate }
```
为单次补考通过补发证书。

#### 证书查询（公开）

```
GET /api/certificates/verify?no={certificateNo}&code={verificationCode}
Res:  { valid: boolean, certificate: { studentName, courseName, issueDate, isRevoked, ... } }
```

公开接口，不需要认证。仅返回公开字段（无手机号、ID 等敏感信息）。

#### 证书撤销

```
POST /api/certificates/:id/revoke
Body: { reason }
Res:  { certificate }
```
权限：仅 SUPER_ADMIN 和 ORG_ADMIN 可操作。

#### 证书列表（后台）

```
GET /api/certificates?examSessionId=&studentId=&page=&limit=
Res:  { items: Certificate[], total }
```

### 5.3 证书编号规则

格式：`FX-{场次日期}-{4位流水号}`

```
FX-20260619-0001
FX-20260619-0002
```

- 按考试场次独立序列（每个场次从 0001 开始）
- 如补考后重发，编号改为 `FX-{场次日期}-{原流水号}-R`
- 数据库里 `certificateNo` 字段 unique，不要依赖前端生成

### 5.4 权限点补充

在 `permissions.constants.ts` 中补充证书相关权限：

```typescript
// ── 证书管理 ──
CERT_ISSUE: 'cert.issue',         // 发证
CERT_REVOKE: 'cert.revoke',       // 撤销证书
CERT_VIEW: 'cert.view',           // 查看证书列表
```

权限映射：
- SUPER_ADMIN: 全部
- ORG_ADMIN: CERT_ISSUE, CERT_REVOKE, CERT_VIEW
- LECTURER: CERT_VIEW
- STUDENT: 仅查看自己的证书

---

## 六、前端修改

### 6.1 阅卷中心修补

1. **错别字修复**：`grading/[examId]/page.tsx` 第 85 行 "已提文学员" → "已提交学员"
2. **发布确认弹窗**：发布按钮加二次确认："注意：成绩发布后学员将看到成绩，不可撤回。确认发布？"
3. **按钮权限控制**：按照 roles/permissions 控制评分、发布、调整按钮的可见性
4. **Loading 状态**：评分、发布、调整按钮加 loading 状态，防止重复提交
5. **评分进度标记**：阅卷列表页（`grading/page.tsx`）每行增加评分进度标记：
   - 已提交但无主观题（纯客观题）：显示「已自动判分」标记（绿色）
   - 已提交且有主观题未评完：显示「待阅卷 (X/Y)」其中 X=已评主观题数，Y=总主观题数
   - 所有题已评完等待发布：显示「待发布」
   - 已发布：显示「已发布」

### 6.2 证书管理界面（新增）

新建路由 `/certificates`：

- 证书列表页：按考试场次筛选，显示字段（证书号、学员、发证日期、状态）
- 发证操作入口：在阅卷详情页成绩发布后显示"发证"按钮
- 证书查看/下载：PDF 下载链接
- 撤销证书操作（带确认）

### 6.3 学员端证书查看

在学员端的"我的考试"或"我的证书"页面：
- 显示学员名下的证书列表
- 可下载 PDF
- 显示证书状态（有效/已撤销）

---

## 七、证书 PDF 生成方案

### 技术选型（二选一）

**推荐方案 A：服务端 puppeteer（先做）**
- 用 HTML + CSS 设计证书模板
- puppeteer 渲染成 PDF
- 优点：模板灵活、支持中文排版、图片嵌入方便

**备选方案 B：pdfkit**
- 纯 Node.js，不需要浏览器
- 优点：轻量、启动快
- 缺点：复杂排版麻烦

> 二期推荐方案 A，先做一个简单模板即可：证书名称、学员姓名、考试名称、证书编号、防伪码、日期、电子印章（图片）。

### PDF 内容

```
┌─────────────────────────────────────┐
│                                     │
│         ⭐  FoxLearn 证书           │
│                                     │
│     兹证明                        │
│        [学生姓名]                   │
│     参加 [考试名称]                │
│     成绩合格，特发此证              │
│                                     │
│     证书编号：[FX-20260619-0001]    │
│     发证日期：[2026年6月19日]       │
│                                     │
│     验证码：[fc92a1b3...]           │
│     查询：foxlearn.com/verify       │
│                                     │
│     ┌─────────┐                     │
│     │ [公章]   │                     │
│     └─────────┘                     │
└─────────────────────────────────────┘
```

---

## 八、实施顺序

⚠️ **先读 5.1.1 的现有代码 bug**，Step 0 里先修了再走后面的。

| 步骤 | 内容 | 预估 |
|------|------|------|
| **Step 0** | 修复现有 bug（passingScore 硬编码、主观题判断逻辑、publishResults 空壳） | 1h |
| **Step 1** | Prisma schema：Exam 加字段 + Certificate + CertificateVerificationLog + ExamSession 加 scoringStatus | 1h |
| **Step 2** | `prisma db push` 推 schema（用 push 不是 migrate dev）+ 安装 puppeteer | 0.5h |
| **Step 3** | 客观题自动判分 — 确认 autoGrade 已存在（exams.service.ts 404-492行），只需确认交卷时调用 + 改用 passingScore 字段 | 0.5h |
| **Step 4** | 补充 grading controller 的状态机逻辑（gradeAnswer 自动更新 scoringStatus、publish 真正写 DB、adjust 更新 status） | 1.5h |
| **Step 5** | 证书模块后端（CRUD + 编号生成 + PDF 渲染 + 公开查询） | 3h |
| **Step 6** | 证书管理前端（列表页 + 发证操作入口 + PDF 下载） | 2h |
| **Step 7** | 修补现有阅卷前端（错别字、确认弹窗、权限、loading、评分进度标记） | 1.5h |
| **Step 8** | 学员端证书查看页 | 1h |

**合计约 11.5h 开发量。**

---

## 九、注意事项（告诉 Claude Code 的陷阱）

1. **不要提前泛化 CertificateRule**：SINGLE 模式不需要独立的规则引擎，exam 自带字段足够
2. **发布不可撤回**：publish 接口成功后，不可以有 unpublish。要修改成绩走 ADJUST 流程
3. **证书编号必须唯一**：在数据库层面设 unique，不要依赖代码检查
4. **证书公开查询接口不需要认证**：但只返回公开信息（姓名、证书号、考试名称、发证日期、状态）
5. **防伪码用 crypto.randomBytes(32).toString('hex')** 生成，8 位可读短码也可
6. **PDF 临时保存路径**：`server/uploads/certificates/`，定期清理或保留供下载
7. **不要修改 `foxlearn-exam-cert-design.md`**：那份是设计思路文档，保留作为参考
8. **scoringStatus 是独立字段，不修改 status**：`ExamSession.status`（ASSIGNED→ACTIVE→PAUSED→SUBMITTED）不动，阅卷走 `scoringStatus`
9. **publish 要写 DB**：不光是校验，通过后要 `updateMany({scoringStatus: 'PUBLISHED', scoringPublishedAt: new Date()})`
10. **客观题自动判分已存在**：exams.service.ts 404-492 行有 autoGrade 方法，不需要重写。确认交卷时被调用即可
11. **不要依赖 isCorrect===null 判断主观题**：改为检查 question.type 是否为 SHORT_ANSWER/ESSAY 等主观题型
12. **puppeteer 需要 Chromium**：`npm install puppeteer` 会自动下载 Chromium（约 300MB），确保有空间和网络

---

## 十、验证清单

完成后检查：

- [ ] 阅卷完成后可以发布成绩
- [ ] 发布后学员可见成绩（需模拟学员端确认）
- [ ] 成绩发布后可调整，并记录审计日志
- [ ] 调整后需重新发布
- [ ] 发布前校验 —— 有未评完学员时拒绝发布，返回具体名单
- [ ] 纯客观题考试：交卷即自动判分，不需要人工阅卷即可发布
- [ ] 阅卷列表页显示评分进度标记（已自动判分/待阅卷 N/M/待发布/已发布）
- [ ] 成绩发布后学员才能看到证书"去领取"入口
- [ ] 发证生成唯一编号（格式 FX-日期-流水号）
- [ ] PDF 可正常下载打开
- [ ] 证书撤销后 PDF 标记（或重新生成撤销版本）
- [ ] 公开查询接口在没有认证的情况下可查
- [ ] 已撤销证书查询时显示"此证书已撤销"
- [ ] passingScore 从 Exam 表取值，3 处硬编码 60% 已去除
- [ ] 主观题判断改用 question.type，不用 isCorrect===null
- [ ] prisma db push 成功推入 schema 变更（不依赖 migrate dev）

---

这份就是给 Claude Code 的直接指令，按步骤实施即可。有需要调整的地方告诉我。
