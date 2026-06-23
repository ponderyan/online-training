# FoxLearn Claude Code 实施任务文档

> ⏰ 最后更新：2025-06-20
> 📁 项目路径：`/Users/ponder/projects/online-training`
> 🐱 项目结构：`server/`（NestJS 后端）+ `client/`（Next.js 前端）

---

## 一、小狐狸已经修好的后端内容（你不需要再改）

### ✅ PermissionGuard 已改为查数据库
`server/src/common/guards/permission.guard.ts` 现在：
- 注入 PrismaService，先查 `role` 表获取 role ID
- 再查 `role_permission` 表看该权限是否授予
- 如果数据库没有记录，fallback 到静态常量 `ROLE_PERMISSIONS`

### ✅ 所有控制器已加 @RequirePermission 注解
以下控制器已添加权限保护（data-modifying 端点）：
- **QuestionsController** — `QUESTION_CREATE` / `QUESTION_EDIT` / `QUESTION_DELETE`
- **ChaptersController** — `QUESTION_EDIT`
- **SubjectsController** — `SYSTEM_DICTIONARY`
- **TagsController** — `SYSTEM_DICTIONARY`（含新增 update 端点）
- **TemplatesController** — `TEMPLATE_MANAGE`（含新增 update 端点）
- **DataDictionaryController** — `SYSTEM_DICTIONARY`
- **AiConfigController** — `SYSTEM_CONFIG`
- **MaterialsController** — `MATERIAL_UPLOAD` / `MATERIAL_REVIEW` / `MATERIAL_GENERATE`
- **StudentsController** — `STUDENT_CREATE` / `STUDENT_EDIT` / `STUDENT_IMPORT` / `STUDENT_GROUP`

### ✅ 后端已补 tags/templates update 端点
- TagsService: 新增 `update(id, data)` 方法
- TemplatesService: 新增 `update(id, data)` 方法（含 typeConfigs 重建逻辑）
- 后端 build 通过

---

## 二、后端仍需改的内容（你做）

### 2.1 User.role → roleId 关联 + 多角色支持（schema 变更）

**现状问题**：`User.role` 是 String 字段（`SUPER_ADMIN`/`ORG_ADMIN`/`LECTURER`/`PROCTOR`/`STUDENT`），无法支持用户分配多个角色。

**改法**：

1. `prisma/schema.prisma`：

```prisma
model User {
  id            Int      @id @default(autoincrement())
  username      String   @unique
  displayName   String
  password      String
  role          String   @default("STUDENT")  // 保留主角色，用于旧代码兼容
  // ↑ 暂时不动这个字段，上面加一个多对多
  roles         UserRoleAssignment[]
  // ... 其余不变
}

model UserRoleAssignment {
  id        Int      @id @default(autoincrement())
  userId    Int
  roleId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, roleId])
  @@map("user_role_assignments")
}
```

**实施方案**（稳妥渐进，不破坏已有代码）：
- 保留 `User.role` String 字段做兼容（用户的"主角色"）
- 新增 `UserRoleAssignment` 表实现多对多
- seed 时给每个用户自动分配至少一个角色（与 `User.role` 一致）
- JWT payload 增加 `roles: string[]` 字段（包含所有分配的角色）
- PermissionGuard 优先用 `user.roles` 数组查权限，仍保留主角色 fallback

**JWT 策略**（`server/src/modules/auth/jwt.strategy.ts` 和 `auth.service.ts`）：登录时查询用户拥有的所有角色 code，写入 payload：
```typescript
// auth.service.ts login 方法
const roles = await this.prisma.userRoleAssignment.findMany({
  where: { userId: user.id },
  include: { role: true }
});
const roleCodes = roles.map(r => r.role.code);
// JWT payload 增加
payload.roles = roleCodes;
```

### 2.2 前端 api.ts 补充

`client/src/lib/api.ts` 目前缺少的方法（已列出，你逐个补）：

```typescript
// subjects — 缺少 update 和 delete
subjects: {
  list: ..., get: ..., create: ...,
  update: (id: number, data: any) => request<any>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/subjects/${id}`, { method: 'DELETE' }),
},

// chapters — 缺少 create、update、delete
chapters: {
  list: ...,
  create: (data: any) => request<any>('/chapters', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/chapters/${id}`, { method: 'DELETE' }),
},

// tags — 缺少 update
tags: {
  list: ...,
  create: (data: any) => request<any>('/tags', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string }) => request<any>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/tags/${id}`, { method: 'DELETE' }),
},

// templates — 补 get 和 update
templates: {
  list: ..., get: ..., create: ..., delete: ...,
  update: (id: number, data: any) => request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
},

// accounts — 新增 users 分组（管理员/讲师/监考员用这个，不混在 students 里）
// 注意：accounts 页面目前直接用 fetch('/api/students?...&allRoles=true') 来拿所有用户
// 这不是问题，但后续可以拆成专门的 /api/users 端点
```

### 2.3 后端补充 CHP (create update delete) 端点

**TagsController**: 已补 update，缺的 controller 端点已在 step 1 加好
**TemplatesController**: 已补 update
**SubjectsController**: controller 已有 CRUD 端点，确认 subjects.service.ts 有 update/delete 方法（service 层如果缺，补上）
**ChaptersController**: controller 已有 CRUD 端点，确认 chapters.service.ts 有 create/update/delete 方法

---

## 三、前端页面需要改的（重点 — 你做）

### 3.1 全局问题：所有页面用 `fetch(url, { headers })` 的改为 `api.xxx.yyy()`

当前 `accounts/page.tsx` 等页面直接用 fetch + 手动拼 Authorization header，应改为用 `api.students.xxx()` 统一调用。

**具体需要改的文件**：
- `client/src/app/accounts/page.tsx` — 用 `api.students.list()` / `api.students.update()` / `api.students.create()` / `api.students.resetPassword()`
- `client/src/app/permissions/page.tsx` — 用 `api` 方式
- 其他页面如果也直接 fetch，同样改

### 3.2 考试列表页（exams/page.tsx）—— 加搜索筛选

**当前**：仅显示全部考试列表，卡片式布局，无搜索/筛选/分页。

**改后需求**：
```
┌─────────────────────────────────────────────────────┐
│  📋 考试管理           total 场次         [+ 创建考试] │
│                                                      │
│  [🔍 搜索考试标题…]  [全部状态 ▼]  [全部试卷 ▼]        │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 2025年6月ITSS培训考试            已结束          │ │
│  │ 试卷：ITSS基础 · 学员：23人 · 时长：120分钟      │ │
│  │ 开始：2025-06-15 09:00                        │ │
│  └─────────────────────────────────────────────────┘ │
│  ...                                                 │
│  [分页 1 2 3 ...]                                    │
└─────────────────────────────────────────────────────┘
```

**字段**：
- 搜索：标题 keyword
- 筛选：`status` 下拉（全部/草稿/已发布/进行中/已完成/已取消）
- 筛选：`paperId` 下拉（可选，关联试卷）
- 分页：页码 + 每页条数（默认 20）
- 每项显示：标题、关联试卷名称、学员数、时长、开始时间、状态标签

**API 调用**：`api.exams.list(params)` → 后端需要支持 `keyword`、`status`、`paperId`、`page`、`pageSize` 参数（目前 exams controller 未支持查询参数，需要后端补）

**后端需要改**：`exams.controller.ts` 和 `exams.service.ts` 增加查询参数支持。

### 3.3 考试详情页（exams/[id]/page.tsx）—— 较完整，检查

**当前状态**：未知，需要确认以下功能是否存在：
- 基本考试信息展示/编辑
- 学员分配列表（已选学员 + 可添加/移除）
- 考试状态操作（发布/开始/结束/取消）
- 成绩概览入口

> 你打开文件检查，如果缺功能按以下补：
> - 学员分配：搜索学员 + 多选添加 + 列表显示已分配学员 + 移除
> - 操作按钮：草稿→发布→开始→结束 的状态流转，每个状态只显示可执行的操作
> - 统计卡片：已分配人数、已提交人数、平均分、通过率（如果成绩已发布）

### 3.4 阅卷列表页（grading/page.tsx）—— 加数据概览

**当前**：仅有简单的考试卡片列表，点进去阅卷。

**改后需求**：

```
┌─────────────────────────────────────────────────────┐
│  📊 阅卷中心                                         │
│                                                      │
│  待阅卷：5场    待判分：43人    已发布成绩：12场       │
│                                                      │
│  [🔍 搜索考试…]  [全部状态 ▼]                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 📋 ITSS培训考试      ⏳ 待判分：8/23人         │    │
│  │ 试卷：ITSS基础 · 开始：2025-06-15             │    │
│  │ 进入阅卷 →                                    │    │
│  └──────────────────────────────────────────────┘    │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

**字段**：
- 顶部统计：待阅卷场次数、总待判分人数、已发布成绩场次数
- 搜索 + 状态筛选
- 每项显示：考试标题、试卷名、开始时间、待判分人数/总人数
- 按"待判分人数"降序排列（人最多的排最前面）

**API**：复用 `api.exams.list()`，但后端需要增加 `pendingGradingCount` 字段，或者前端可以自己过滤。

### 3.5 阅卷详情页（grading/[id]/page.tsx）—— 已有，检查

**当前状态**：未知，需要打开确认。至少应该包含：
- 学员成绩列表（姓名、总分、客观题分、主观题分、状态）
- 点击进入具体学员的主观题判分页面
- 成绩发布按钮

> 你打开检查，如果缺功能补上。特别注意：
> - 成绩状态显示（未判/判分中/待发布/已发布/已调整）
> - 批量操作：选中学员 → 一键发布成绩
> - 搜索学员姓名
> - 成绩调整入口（分数旁边显示调整按钮）

### 3.6 账户管理页（accounts/page.tsx）—— 功能完整，加角色多选

**当前**：已有 CRUD + 分组 + 重置密码 + 启用/停用。缺：
1. 直接 fetch 改为用 `api.students.xxx()` 
2. **角色多选支持**（schema 改了才有，见 2.1 节）

**如果多角色 schema 已完成**：
- 创建/编辑弹窗的角色选择改为多选（checkbox 列表）
- 列表显示所有角色标签
- 接口传 `roles: string[]`

### 3.7 权限管理页（permissions/page.tsx）—— 功能较完整

**当前**：已有角色 CRUD + 权限勾选矩阵。点检以下：
- 直接 fetch 改为用 api 方式
- 新建角色成功后刷新权限矩阵

> 你检查，如果功能正常不必大改。主要改成 API 统一调用。

### 3.8 学生管理页（students/page.tsx）—— 需要点检

**当前**：未知。你打开检查，至少应该包含：
- 学员列表（搜索/分页）
- 创建学员（弹窗）
- 导入学员（CSV）
- 学员详情链接
- 分组管理

> 如果缺任何一项，补上。

### 3.9 试卷管理页（papers/page.tsx）

**当前**：未知。你打开检查，功能需求：
- 试卷列表（分页、搜索标题）
- 创建试卷（用模板或手动生成）
- 编辑试卷（添加/删除题目）
- 定稿/发布操作
- 试卷状态标签

### 3.10 证书管理页（certificates/page.tsx）

**当前**：未知。功能需求：
- 证书列表（搜索证书编号/学员姓名）
- 发证入口
- 撤销证书
- 查看证书详情
- 下载 PDF
- 防伪码查询入口

### 3.11 题目管理页（questions/page.tsx）

**当前**：未知。功能需求：
- 题目列表（题型筛选、科目筛选、难度筛选、搜索关键字）
- 创建题目（弹窗或页面，支持选择题/判断题/填空题/简答题）
- 编辑/删除
- 批量导入

### 3.12 教材管理页（materials/page.tsx）

**当前**：未知。功能需求：
- 教材列表（名称、类型、状态、上传时间）
- 上传教材
- 查看AI出题结果
- 审核AI生成的题目
- 删除

### 3.13 题库配置（subjects/chapters/tags）

**当前**：这些作为 settings 的子页面或独立页面存在。你检查：
- `subjects`（科目管理）：CRUD
- `chapters`（章节管理）：按科目查看，CRUD
- `tags`（标签管理）：CRUD

> 这些比较基础，缺什么补什么即可。

---

## 四、实施顺序建议

```
优先级 P0（不突破系统不可用）：
  1. 后端 exams 列表加搜索/筛选/分页参数（考试列表+阅卷列表依赖）
  2. 前端考试列表 + 阅卷列表改好
  3. api.ts 补全缺失的方法
  4. 所有页面从直接 fetch 改为 api.xxx 调用

优先级 P1（日常使用高频）：
  5. 账户管理页加角色多选
  6. 试卷管理页完善
  7. 题目管理页完善
  8. 学生管理页完善
  9. 教材管理页完善
  10. 权限管理页改 api 调用

优先级 P2（低频/基础配置）：
  11. 证书管理页完善
  12. 题库配置（subjects/chapters/tags）完善
```

---

## 五、注意事项

1. **不要动数据库密码**：当前数据库密码在 `server/.env` 中，已配置正确
2. **后端启动**：用 `npm run start` 而非 `npm run dev`（Prisma 正常引擎模式）
3. **样式系统**：前端使用 CSS 变量体系（`var(--fox)`、`var(--ink-*)`、`var(--verm)` 等），`btn`、`tag`、`input`、`card`、`modal-*`、`list-table` 等 class 全局可用
4. **组件库**：AppLayout 是统一布局组件，所有页面必须包裹
5. **小狐狸的审查**：你改完之后我会 review，有问题的我会直接在文件里标记

---

## 附件：现有后端 API 路线图

| 前缀 | 模块 | 状态 |
|------|------|------|
| `/api/auth` | 登录/验证码 | 正常 |
| `/api/subjects` | 科目 | ✅ 已加权限 |
| `/api/chapters` | 章节 | ✅ 已加权限 |
| `/api/questions` | 题目 | ✅ 已加权限 |
| `/api/papers` | 试卷 | 已有权限 |
| `/api/templates` | 出题模板 | ✅ 已加权限 + 补 update |
| `/api/tags` | 标签 | ✅ 已加权限 + 补 update |
| `/api/exams` | 考试 | 已有权限（待补筛选参数） |
| `/api/grading` | 阅卷 | 已有权限（待检查） |
| `/api/certificates` | 证书 | 已有权限（待检查） |
| `/api/students` | 学员 | ✅ 已加权限 |
| `/api/materials` | 教材 | ✅ 已加权限 |
| `/api/data-dictionaries` | 数据字典 | ✅ 已加权限 |
| `/api/ai-configs` | AI 配置 | ✅ 已加权限 |
| `/api/permissions` | 权限管理 | 已有权限 |
| `/api/projects` | 项目 | 已有权限 |
