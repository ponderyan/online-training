# 全模块组织隔离补全 — 实施记录

> 日期：2026-07-30
> 前置工作：考试模块组织隔离（2026-07-29 完成）

## 一、背景

考试模块（Exam）已完成组织隔离后，排查发现其余模块普遍存在 IDOR 隐患：
通过实体 ID 直接访问子资源时不校验组织归属，任何持有合法 token 的管理员可越权操作其他组织数据。

## 二、排查结论

| 分类 | 模块 | 问题 |
|------|------|------|
| A-严重 | Training Programs | 25+ 端点完全无隔离 |
| A-严重 | Papers | 12 个操作端点绕过 org 校验 |
| B-中等 | Certificates | 7 端点缺隔离 |
| B-中等 | Learning Hours | 6 端点缺隔离 |
| B-中等 | Learning Hour Certificates | 5 端点缺隔离 |
| C-间接 | Materials | 模型无 orgId，通过 subject.orgId 间接隔离 |
| C-间接 | Instructors | 通过 user.orgId 列表过滤 |
| 不动 | VideoCourse / Course | 公共资源语义，不做隔离 |

## 三、技术方案

### 3.1 核心组件

新建 ResourceAccessService（全局共享，注册于 ExamAccessModule）：
- src/common/services/resource-access.service.ts

提供方法：
- assertProgramAccess / assertPaperAccess / assertCertificateAccess
- assertLhcAccess / assertMaterialAccess / assertLearningHourAccess
- getVisibleOrgIds（组织树 path 前缀匹配）

### 3.2 隔离规则

1. SUPER_ADMIN → 放行
2. entity.orgId = null（系统级资源）→ 对所有管理员可见
3. 非超管 → entity.orgId 必须在用户可见组织列表（自身 + 子孙）内
4. 列表端点 → where 条件追加 orgId IN visibleOrgIds

### 3.3 修改文件清单（13 个文件）

- src/common/services/resource-access.service.ts（新建）
- src/common/services/exam-access.module.ts
- src/modules/training-programs/training-programs.controller.ts
- src/modules/papers/papers.controller.ts
- src/modules/certificates/certificates.controller.ts
- src/modules/certificates/certificates.service.ts
- src/modules/learning-hours/learning-hours.controller.ts
- src/modules/learning-hours/learning-hours.service.ts
- src/modules/learning-hour-certificates/learning-hour-certificates.controller.ts
- src/modules/learning-hour-certificates/learning-hour-certificates.service.ts
- src/modules/materials/materials.controller.ts
- src/modules/instructors/instructors.controller.ts
- src/modules/instructors/instructors.service.ts

## 四、测试结果

### 4.1 构建：npx tsc --noEmit → 0 errors

### 4.2 SUPER_ADMIN 回归（15 端点全部正常）

TP list/findOne/update/batches/dashboard, Papers list/findOne,
Certificates list/traces, LH list/pending, LHC list/findOne,
Instructors list, Exams list — 全部 OK

### 4.3 跨组织隔离（branch_admin org5 → 不可见 org1 数据，13 项全部 PASS）

- by-ID 端点返回 404
- 列表端点返回 total=0
- orgId=null 系统资源仍可见（设计如此）

## 五、设计决策

- Material 不加 orgId：通过 subject.orgId 间接隔离
- VideoCourse/Course 不动：公共资源语义
- Instructor 仅列表过滤：通过 user.orgId 间接
- orgId=null 视为系统级：与 Exam 一致
- 统一返回 404：防止信息泄露

## 六、遗留

- 前端适配列表空数据 UI
- Filing 模块通过 program 已间接隔离
- 考虑 getVisibleOrgIds 缓存优化
