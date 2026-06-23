# 阅卷模块修复实施方案

## 问题 1：学员端成绩可见性控制（🔴 关键漏洞）

### 背景
学员端 `getResult()` 和 `getStudentExams()` 没有检查 `scoringStatus`。学员可以在管理员发布成绩前通过 `/api/student/exams/:id/result` 或考试列表看到自己的分数。

### 改动文件
`server/src/modules/exams/exams.service.ts`

### 修改 1.1：fix `getResult()`

在 `getResult()` 方法中，查出 `session` 后，检查 `scoringStatus`：

```
// 在 return 之前，如果成绩未发布，只返回基本信息
if (session.scoringStatus !== 'PUBLISHED' && session.scoringStatus !== 'ADJUSTED') {
  return {
    available: false,
    examTitle: session.exam.title,
    paperName: session.exam.paper.name,
    submittedAt: session.submittedAt,
    message: '成绩尚未发布',
  };
}
```

> `ADJUSTED` 状态也要可见的原因：调整后的成绩已存在，但需要重新发布才最终生效。可以让学员在 ADJUSTED 时也看不到，等管理员重新发布。两种策略都可以，我倾向 ADJUSTED 时也可见（因为调整是管理员操作的权威修正）。

### 修改 1.2：fix `getStudentExams()`

在 `getStudentExams()` 的 `map` 回调中，填充 `myScore`、`myFinalScore`、`isPassed` 时，判断 `scoringStatus`：

```
myScore: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.totalScore : null,
myFinalScore: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.finalScore : null,
isPassed: s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'ADJUSTED' ? s.isPassed : null,
```

注意：`getStudentExams` 的 `include` 中需要加上 `scoringStatus` 字段。当前 include 没有显式选它，但 Prisma 默认返回所有 scalar 字段（除非用了 `select`），所以应该已经有了。

---

## 问题 2：纯客观题考试自动进入 GRADED（🔴 关键漏洞）

### 背景
纯客观题考试提交后，autoGrade 已完成所有判分，但 scoringStatus 一直是 `PENDING`，不会自动变成 `GRADED`。管理员需要手动进阅卷中心点"发布"，但阅卷中心列表只显示有主观题未评分的学员——纯客观题考试的学员不会出现在阅卷中心，导致永远无法发布。

### 改动文件
`server/src/modules/exams/exams.service.ts`

### 修改 2.1：fix `submitExam()`

在 `autoGrade(session.id)` 之后、设置 `scoringStatus: 'PENDING'` 之前，检查该考试是否有主观题：

```typescript
// 检查考试是否有主观题
const examWithPaper = await this.prisma.exam.findUnique({
  where: { id: examId },
  include: {
    paper: {
      include: {
        questions: {
          include: { question: { select: { type: true } } },
        },
      },
    },
  },
});

const hasSubjective = examWithPaper?.paper?.questions?.some(
  (pq: any) => pq.question.type === 'SHORT_ANSWER' || pq.question.type === 'CASE_STUDY'
) ?? false;
```

然后：

```typescript
scoringStatus: hasSubjective ? 'PENDING' : 'GRADED',
```

完整修改位置：在 `submitExam()` 方法中，设置 session 状态为 SUBMITTED 的部分（当前在 `autoGrade` 调用之后）。把原来写死的 `scoringStatus: 'PENDING'` 改为条件判断。

---

## 问题 3：成绩字段 Int → Float（🟡 次要改进）

### 背景
主观题评分需要支持小数（如 7.5 分），但 `ExamAnswer.score`、`ExamSession.totalScore`、`ExamSession.subjectiveScore`、`ExamSession.finalScore`、`ScoreAuditLog.originalScore`、`ScoreAuditLog.adjustedScore` 目前都是 `Int` 类型。

### 改动文件
`server/prisma/schema.prisma`

### 修改 3.1：修改字段类型

```prisma
// ExamAnswer
score           Float?    // 原 Int?

// ExamSession
totalScore      Float?    // 原 Int?
subjectiveScore Float?    // 原 Int?
finalScore      Float?    // 原 Int?

// ScoreAuditLog
originalScore   Float     // 原 Int
adjustedScore   Float     // 原 Int
```

修改后需要运行 `npx prisma db push` 同步数据库。

### 修改 3.2：更新 Service 中所有赋值处

`exams.service.ts` 中 `autoGrade()` 方法里有 `totalScore` 累加：

```typescript
// totalScore 本身就是 number，不需要改
let totalScore = 0;
```

这个没问题，因为 TypeScript 的 `number` 同时支持 int 和 float。但 `score` 在 `autoGrade` 的 `switch` 里是 `let score = 0` —— 也要改成 `let score: number = 0`（虽然 TypeScript 能推断）。

`grading.controller.ts` 中 `adjustedScore` 参数类型已经是 `number`，不用改。
`grading.controller.ts` 中 `gradeAnswer` 中 `score` 参数已是 `number`，不用改。

但要注意：`gradeAnswer` 中 `totalScore` 的 `reduce` 累加：

```typescript
.reduce((sum, a) => sum + (a.score || 0), 0);
```

`score` 现在是 `Float?`，所以 `(a.score || 0)` 的结果是 `number`，没问题。

---

## 执行顺序

1. 先改 `schema.prisma`（Int → Float）
2. 运行 `npx prisma db push` 同步数据库
3. 改 `exams.service.ts`（getResult + getStudentExams + submitExam）
4. 验证编译无报错
5. 重启后端验证（`npm run start`）
