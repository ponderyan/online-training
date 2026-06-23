# api.ts 与后端控制器路由匹配检查报告

> 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
> 项目路径: ~/projects/online-training

---

## 一、整体统计

| 指标 | 数量 |
|------|------|
| 后端 Controller 总数 | 34+ 个模块 |
| api.ts 中已暴露的模块 | 26 个模块 |
| **后端有但前端完全未暴露的模块** | **7 个** |
| **后端有但前端未暴露的方法** | **20+ 个** |
| **路由匹配不一致/有问题的方法** | **2 个** |

---

## 二、后端有但 api.ts 完全未暴露的模块（严重缺失）

这些后端的 Controller 在 api.ts 中没有对应的 API 方法：

| 后端路由 | Controller 文件 | 可用方法 |
|----------|----------------|---------|
| `api/user/profile` | `auth/user-profile.controller.ts` | `GET` 获取个人资料, `PUT` 更新资料 |
| `api/user/password` | `auth/user-profile.controller.ts` | `POST` 修改密码 |
| `api/attachments/*` | `attachments/attachments.controller.ts` | `POST upload`, `GET` 列表, `GET :id/file` 下载, `DELETE :id`, `POST :id/verify` |
| `api/organizations/*` | `organizations/organizations.controller.ts` | `GET` 列表, `GET :id`, `POST`, `PUT`, `DELETE` |
| `api/site-settings` | `site-settings/site-settings.controller.ts` | `GET`, `PUT` |
| `api/student/exams/*` | `exams/student-exam.controller.ts` | `GET` 学员考试列表, `GET :id` 开始考试, `POST :id/submit` 交卷, `POST :id/heartbeat`, `GET :id/result` |
| `api/grading-assignments/*` | `grading/grading-assignment.controller.ts` | `GET :examId`, `POST :examId`, `PUT :examId/:assignmentId`, `DELETE`, `GET my/assignments` |
| `api/grading-reviews/*` | `grading/review.controller.ts` | `GET :examId`, `POST :examId/request`, `POST :examId/:reviewId/resolve` |

---

## 三、后端有但 api.ts 中未暴露的独立方法（中度缺失）

这些方法在后端 Controller 中存在，但 api.ts 中没有对应的调用：

### 3.1 Auth
- `POST /api/auth/register` — 注册接口（后端实现了但前端未暴露）

### 3.2 Questions
- `GET /api/questions/practice` — 获取练习题目列表（支持筛选 count/subjectId/types/chapterId）
- `POST /api/questions/ai-generate` — AI 智能出题（占位）

### 3.3 Papers（试卷导出系列）
- `POST /api/papers/:id/upload-word` — 上传 Word 试卷
- `GET /api/papers/:id/export-word` — 导出 Word
- `GET /api/papers/:id/export-answer-sheet` — 导出答题卡
- `GET /api/papers/:id/export-pdf` — 导出 PDF
- `GET /api/papers/export-preview/:id` — 导出预览

### 3.4 Exams
- `GET /api/exams/:id/grading-progress` — 阅卷进度统计
- `GET /api/exams/:id/sessions/status-summary` — 考试会话状态汇总

### 3.5 Certificates
- `GET /api/certificates/:id/traces` — 证书追溯链
- `GET /api/certificates/:id` — 获取单个证书详情（后端没有直接的 GET `:id` 路由，但有 GET 列表）

### 3.6 Grading
- `POST /api/grading/:examId/confirm` — 成绩确认/锁存
- `POST /api/grading/:examId/unlock` — 解锁成绩

### 3.7 Materials
- `POST /api/materials` — 创建教材（JSON body）
- `POST /api/materials/:id/generate` — 从教材生成题目

### 3.8 Video Courses
- `POST /api/video-courses/upload` — 视频文件上传
- `GET /api/video-courses/:id/stream` — 视频流播放

### 3.9 Knowledge
- `POST /api/knowledge/documents` — 上传文档（占位）

### 3.10 Data Import/Export
- `POST /api/data/import/:module` — 导入文件
- `GET /api/data/export/logs` — 导出日志
- `GET /api/data/export/:module` — 导出数据

### 3.11 Training Programs（批次管理）
- 批次 CRUD: `batches/:batchId` (GET/PUT/DELETE)
- `POST :id/batches` — 创建批次
- `PUT batches/:batchId/head-teacher` — 设置班主任
- 批次成员管理: `batches/:batchId/members` (GET/POST/DELETE)

---

## 四、路由匹配不一致/潜在问题

### 🔴 问题 1：`trainingPrograms.generateSigninSheet` 返回类型与后端不匹配

**api.ts 定义:**
```typescript
generateSigninSheet: (programId: number) =>
  request<{ fileName: string }>(`/training-programs/${programId}/generate-signin-sheet`)
```

**后端实现 (training-programs.controller.ts L62-67):**
```typescript
@Get(':id/generate-signin-sheet')
async generateSignin(@Param('id') id: number, @Res() res: Response) {
  const { buffer, fileName } = await this.evidenceService.generateSigninSheet(id);
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ... });
  res.end(buffer);  // ← 直接返回 Excel 二进制流，不是 JSON
}
```

**风险：** 前端期望 `request()` 返回 `{ fileName: string }` 的 JSON，但后端直接 `res.end(buffer)` 返回二进制 Excel 文件。`request()` 会执行 `res.json()`，导致解析崩溃。应用直接使用 `fetch` + `res.json()` 而不是 `request`，或者使用下载方式处理。

### 🟡 问题 2：`certificates.issue` 参数映射微妙

**api.ts:**
```typescript
issue: (examSessionId: number, studentId: number) =>
  request<any>(`/certificates/${examSessionId}/${studentId}`, { method: 'POST' })
```

**后端 (certificates.controller.ts L20-27):**
```typescript
@Post(':examSessionId/:studentId')
async issueSingle(
  @Param('examSessionId') examSessionId: number,
  @Param('studentId') studentId: number,
) { ... }
```

路由匹配 ✓，但注意 `certificates.controller.ts` 还有一个 `POST /api/certificates`（批量发证）未在 api.ts 中暴露。

### 🟡 问题 3：`permissions` 模块格式化问题

**api.ts 第 275 行** — 所有方法在同一行，无换行：
```typescript
permissions: {    getRoles: () => ...,    createRole: (data: any) => ...,    updateRole: ... ,    deleteRole: ... ,    getMatrix: () => ...,    updateRolePerms: ...  },
```
这只是代码风格问题，功能上路由匹配 ✓。

### 🟡 问题 4：`auditLogs.list` 返回类型不一致

**api.ts:**
```typescript
return request<{ data: any[]; total: number; page: number; pageSize: number }>(`/audit-logs${qs}`);
```

后端其他 list 接口通常返回 `{ items, total, ... }`，但 auditLogs 返回 `{ data, total, ... }`。这可能是故意的，但与项目其他接口约定不一致。

---

## 五、前端有但后端不存在的路由（无问题）

逆向检查发现所有 api.ts 中的路由在后端都有对应实现，没有出现前端调用了后端不存在的路由的情况 ✅

---

## 六、跨层集成完整度评估

### ✅ 良好匹配的模块（CRUD 完整）
| 模块 | 前端方法数 | 后端路由数 | 状态 |
|------|-----------|-----------|------|
| Subjects | 6 | 6 | ✅ |
| Chapters | 5 | 5 | ✅ |
| Data Dictionaries | 4 | 4 | ✅ |
| Tags | 4 | 4 | ✅ |
| Questions | 7 | 8 | ✅（1个未暴露） |
| Templates | 5 | 5 | ✅ |
| Papers | 9 | 12 | ⚠️（3个导出未暴露） |
| Exams | 16 | 15 | ✅ |
| Students | 17 | 16 | ✅ |
| Instructors | 6 | 6 | ✅ |
| Courses | 5 | 5 | ✅ |
| Video Courses | 9 | 11 | ⚠️（2个未暴露） |
| Schedules | 5 | 5 | ✅ |
| Evaluations | 5 | 5 | ✅ |
| AI Configs | 5 | 5 | ✅ |
| Notifications | 4 | 4 | ✅ |
| Training Programs | 18 | 20+ | ⚠️（批次管理未暴露） |

### ❌ 完全缺失的模块（后端完整但前端无调用）
| 模块 | 后端方法数 | 前端覆盖率 | 建议优先级 |
|------|-----------|-----------|-----------|
| 用户资料/密码 | 3 | 0% | 🔴 **高** - 用户基本功能 |
| 附件管理 | 5 | 0% | 🟡 **中** |
| 组织架构 | 5 | 0% | 🟡 **中** |
| 站点设置 | 2 | 0% | 🟡 **中** |
| 学员端考试 | 5 | 0% | 🔴 **高** - 学员核心功能 |
| 阅卷分配 | 5 | 0% | 🟡 **中** |
| 阅卷复核 | 3 | 0% | 🟡 **中** |

---

## 七、总结建议

1. **高优先级：** 在 api.ts 中补充 `api/user/*`（个人资料/密码）、`api/student/exams/*`（学员考试流程） — 这是学员端核心功能缺失
2. **中优先级：** 补充试卷导出系列（Word/PDF/答题卡）、批次管理、数据导入导出
3. **低优先级：** AI 出题占位、知识库上传占位等暂未实现的功能
4. **Bug 修复：** `trainingPrograms.generateSigninSheet` 的返回类型与后端实现不一致，前端实际使用时可能崩溃
5. **一致性：** 建议统一 list 接口的返回字段命名（`items` vs `data`）
