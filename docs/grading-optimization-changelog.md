# 阅卷模块竞品优化 — 过程文档

> 日期：2026-07-26
> 范围：阅卷系统前端+后端优化（基于竞品分析 Gradescope/ExamSoft/优考试/云帆考试/小马阅卷）

---

## 一、修复的逻辑问题

| ID | 问题 | 修复方案 | 文件 |
|----|------|----------|------|
| G1 | publishResults 可发布未评完的卷 | 加 `scoringStatus='GRADED'` 过滤 | grading.controller.ts |
| G2 | 复核改分无上限校验 | 添加 maxScore 验证 | review.controller.ts |
| G3 | 讲师可切换"全部"视图看到未分派卷 | 限制为仅考务员/管理员 | page.tsx |
| G4 | submitExam answers 为 undefined 时崩溃 | 加 `(answers \|\| [])` 容错 | exams.service.ts |

## 二、新增功能

### 2.1 按题批阅（流水阅卷）
- **后端**：`GET /api/grading/:examId/by-question/:pqId`
  - 返回题目信息 + 所有学员该题答案 + 进度统计
  - 支持分派隔离（非考务员只能看被分派的题/学员）
- **前端**：`ByQuestionGrading.tsx`（371行）
  - 左栏题目列表 / 右栏答案浏览+评分
  - 快捷给分按钮（0/50%/80%/满分）
  - 盲批模式支持
  - 键盘快捷键：Enter 提交并下一个，Alt+↑↓ 切换答案

### 2.2 评分 Rubric（扣分点）
- **数据库**：PaperQuestion 新增 `rubric Json?` 字段
- **后端**：`PUT /api/grading/:examId/rubric/:pqId`
  - 格式：`[{description, points, type:'add'|'deduct'}]`
- **前端**：
  - 评分时显示 Rubric 可点击 chips（绿色=得分，红色=扣分）
  - 点击自动累加分数 + 拼接评语
  - 弹窗编辑器（考务员可设置/修改标准）

### 2.3 每题统计分析
- **后端**：`GET /api/grading/:examId/question-stats`
  - 返回每题：平均分、得分率、最高/最低分、正确率、四段分布
- **前端**：进度 Tab 底部表格 + 迷你柱状图

### 2.4 阅卷指派入口
- 阅卷详情页顶部添加「📋 阅卷指派」按钮（考务员/管理员可见）

### 2.5 键盘快捷键
- Enter：提交当前评分并跳转下一份
- Alt+↑/↓：在答案列表中导航

## 三、组件拆分

| 文件 | 行数 | 职责 |
|------|------|------|
| page.tsx | 759 | 主页面（按人阅卷 + Tab 框架 + 弹窗） |
| ByQuestionGrading.tsx | 371 | 按题批阅 + Rubric + 快捷键 |
| GradingProgress.tsx | 249 | 进度统计 + 成绩分布 + 每题分析 |

## 四、路由注意事项

NestJS 按声明顺序匹配路由，必须确保：
```
@Get(':examId')                    ← 单参数
@Get(':examId/by-question/:pqId')  ← 字面量 "by-question"
@Get(':examId/question-stats')     ← 字面量 "question-stats"
@Put(':examId/rubric/:pqId')       ← 字面量 "rubric"
@Get(':examId/:studentId')         ← 参数化（最后）
```

## 五、E2E 测试结果

| 测试项 | 结果 |
|--------|------|
| 学生保存答案（含 questionId） | ✅ |
| 学生提交考试（空 answers 容错） | ✅ |
| 客观题自动判分（10/10） | ✅ |
| 按题批阅 API 返回正确答案 | ✅ |
| 人工评分（18/20）+ 总分重算（28） | ✅ |
| 评分后 session → GRADED | ✅ |
| 发布成绩 + 证书草稿 | ✅ |
| 重复发布拒绝（无 GRADED 卷） | ✅ |
| Rubric 设置/读取 | ✅ |
| 每题统计（avg/rate/distribution） | ✅ |
| 前端 build 无错误 | ✅ |

## 六、测试数据

- Paper 102（阅卷测试卷，30分）：pqId=23(单选10分) + pqId=24(简答20分)
- Exam 120（按题批阅E2E测试）：已发布，分配 stu001(id=8)
- Session 79：SUBMITTED → GRADED → PUBLISHED，总分 28/30

## 七、后续可优化方向

1. 双评仲裁（两位阅卷员独立评分，差异超阈值触发仲裁）
2. AI 辅助评分建议（利用 aiScore 字段）
3. 阅卷效率看板（平均用时/份、每题耗时）
4. 按题批阅的"标记异常"功能（作弊嫌疑标记）
