# 🦊 FoxLearn 协作规范：用户 · Hermes · Claude Code

## 三角色分工

| 角色 | 职责 | 核心工作 |
|------|------|----------|
| **用户** | 需求方 + 最终验收 | 提出需求、业务流程把关、确认方案、验收成果 |
| **Hermes（小狐狸）** | 设计把关人 / 首席架构师 | 数据模型评审、复杂逻辑纠偏、竞品调研、跨模块协调、质量验收 |
| **Claude Code** | 编码执行者 | 按确认方案铺代码骨架、CRUD 实现、前端页面 |

---

## 工作流程

```
用户提需求
    ↓
Hermes 评审需求（必要时前置调研）
    ↓
Hermes ↔ 用户 确认方向 ← → 必要时 Cluade Code 参与讨论
    ↓
Claude Code 铺骨架 / 写代码
    ↓
Hermes 审核骨架
    ↓
用户验收
    ↓
(循环)
```

## 三类工作的审核方式

### 第 1 类：数据模型变更 → Hermes 写代码前审

**原因**：字段名、类型、关系、状态机设计一旦写错，改起来要连带所有层。

**流程**：Claude Code 动手前将 Prisma Schema 变更（新增表/字段/关系/枚举值/索引）发 Hermes → Hermes 确认 → Claude Code 动手。

### 第 2 类：复杂业务逻辑 → Hermes 写代码前审

**原因**：出错了有后果。

**具体范围**：
- 状态机流转（成绩/考试/证书/订单等）
- 权限模型设计
- 涉及钱、证书、成绩的业务规则
- 审计日志 / 防篡改 / 数据可追溯机制
- 涉及多模块联动的流程设计

**流程**：Claude Code 写代码前给出核心逻辑流程描述和设计选型 → Hermes 评审 → 通过后 Claude Code 开写。

### 第 3 类：常规 CRUD + 前端页面 → Claude Code 铺完后 Hermes 扫

**原因**：列表、表单、筛选、分页、增删改查结构性强、出错代价低。

**流程**：Claude Code 直接写 → Hermes 通读时看一眼 → 除非结构性问题，否则不卡。

---

## Claude Code 的交付物格式（给 Hermes 审）

Claude Code 铺完骨架后，只需要输出这三样给 Hermes，不需要 Hermes 通读代码：

### 1. 数据模型变更

```markdown
## 新增表
- `TableA`: { id, name, authorId → User, ... }
- 索引: UK(name, authorId)

## 修改表
- `TableB`: 新增字段 status (DRAFT/PUBLISHED/ARCHIVED)

## 新增枚举
- ExamStatus: PENDING → GRADING → GRADED → PUBLISHED → ADJUSTED
```

### 2. API 路由清单

```markdown
## Questions 模块
| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | /api/questions | 列表（分页+筛选） | 登录 |
| POST | /api/questions | 创建 | 登录 |
| GET | /api/questions/:id | 详情 | 登录 |
| PUT | /api/questions/:id | 更新 | 登录 |
| DELETE | /api/questions/:id | 删除 | 登录 |
| GET | /api/questions/:id/referenced-papers | 引用查询 | 登录 |
```

### 3. 核心逻辑流程

```markdown
## 成绩状态机
PENDING → GRADING(客观题自动)
       → MANUAL_GRADING(主观题需人工)
       → GRADED
       → PUBLISHED(管理员发布)
       → ADJUSTED(复核调整)
       → PUBLISHED(重新发布)

## 边界条件
- 成绩发布后不可直接修改，走复核流程
- 复核需要审批权限
```

---

## Hermes 的回复格式

| 标记 | 含义 |
|------|------|
| ✅ 过，继续 | 可行，不用等 |
| ❌ 退回 | 指出问题 + 给修改方向 |
| ⚠️ 标记 | 模棱两可，等用户决策 |

---

## 原则

1. **不卡进度。** 三类可以并行——Claude Code 写常规 CRUD 的同时把模型变更给 Hermes 看，不冲突。
2. **Hermes 快评快出。** 收到交付物后尽快回复，不堆积。
3. **用户是最终决策者。** Hermes 和 Claude Code 的分歧由用户一锤定音。
4. **没有"谁写的代码谁负责"。** 所有代码都是 FoxLearn 的资产，谁改谁负责。
5. **没有心理负担。** 重写、删除、推翻重来都是正常操作。说"这个方向不对"不是否定，是帮系统做对。

---

## 文件位置

- 项目代码：`/Users/ponder/projects/online-training/`
- 设计文档 / 作业单 / 规范：`/Users/ponder/Desktop/FoxLearn/`
- 协作规范：本文档 `docs/collaboration-convention.md`
