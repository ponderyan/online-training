# FoxLearn · 狐学 — 在线培训考试平台整体设计方案

> 日期：2026-06-16 | 状态：草稿待讨论
> 基于 DT+ 人才培训管理办法/讲师管理办法 分析提取，融合一期智能组卷系统与二期培训考试平台

---

## 一、平台定位

FoxLearn 不是"智能组卷工具"，也不是"在线考试系统"——它是一个**完整的在线培训考试平台**，覆盖从教学资源建设、培训开班、教学实施、考核评价到证书发放的全链路。

三个发展阶段：

```
一期（已完成）    二期（当前规划）         三期（远期）
─────────────────────────────────────────────────────
智能组卷系统  →  在线培训考试平台    →  AI助教知识库
                    │                    │
                ┌───┴───┐               │
           教学资源管理   培训管理运营   个性化学习
```

---

## 二、功能模块全景图

### 总体分层

```
┌─────────────────────────────────────────────────┐
│                  学员端 (Student Portal)          │
│   我的课程 · 在线学习 · 在线考试 · 练习模式        │
│   成绩查询 · 证书下载 · 学时证明 · 申诉            │
├─────────────────────────────────────────────────┤
│                  管理端 (Admin)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 教学资源  │ │ 培训运营  │ │ 评价与证书        │ │
│  │          │ │          │ │                  │ │
│  │ • 课程体系│ │ • 培训班  │ │ • 成绩统计分析    │ │
│  │ • 教材管理│ │ • 学员管理│ │ • 证书管理/发放   │ │
│  │ • 题库管理│ │ • 讲师管理│ │ • 教学质量评价    │ │
│  │ • 智能组卷│ │ • 考勤管理│ │ • 满意度调查      │ │
│  │ • 试卷管理│ │ • 在线考试│ │ • 申诉/违规管理   │ │
│  │ • 模板管理│ │ • 在线监考│ │                  │ │
│  │          │ │ • 判分管理│ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│                   AI 能力层                       │
│   AI出题Pipeline · 智能组卷引擎 · AI助教(三期)    │
├─────────────────────────────────────────────────┤
│                   平台基础层                      │
│   认证授权 · RBAC · 多租户 · 日志 · 消息中心      │
└─────────────────────────────────────────────────┘
```

### 模块划分详解

#### 模块一：平台基础层 ⭐ 二期增强

| 子模块 | 一期现状 | 二期目标 |
|--------|---------|---------|
| 用户认证 | 简单localStorage | JWT + Token刷新 + 多角色登录 |
| RBAC权限 | 骨架已搭，部分API未挂 | 全部挂载 + 权限可视化配置 |
| 多租户 | 字段预留tenant_id | 机构间数据隔离 + 独立管理 |
| 消息通知 | — | 站内红点消息（系统/考试/成绩/审核） |
| 操作日志 | — | 全操作记录 + 审计追溯 |
| 数据字典 | ✅ 已有 | 扩展(证书编号规则/班号规则) |
| 系统配置 | AI配置 ✅ | 通用系统参数配置 |

#### 模块二：教学资源中心 ← 一期核心，二期增强

| 子模块 | 一期现状 | 二期变化 |
|--------|---------|---------|
| 课程体系 | 科目/章节 ✅ | 扩充为多层级课程目录 |
| 教材管理 | 上传/AI出题/审核 ✅ | 加版本管理 + 版本历史 |
| 题库管理 | 多题型/标签/导入 ✅ | 加练习组/考试组/通用组分批 + 试题使用记录 |
| 组卷模板 | ✅ | 关联到考试类型（正式考/练习） |
| 智能组卷 | ✅ | 组卷结果直接关联考试场次 |
| 试卷管理 | 生成/编辑/定稿/导出 ✅ | 加试卷发布状态（关联考试） |

#### 模块三：培训运营 ⭐ 二期新增

| 子模块 | 说明 |
|--------|------|
| **培训班管理** | 班级创建→配课程→配讲师→配考试→开班/结班 |
| **学员管理** | 导入/分组/分配到班级/学习轨迹 |
| **讲师管理** | 讲师库/分级/资质/授课记录/考评 |
| **考勤管理** | 签到记录/出勤率计算/出勤与考试资格关联 |
| **在线考试** | 考试场次/统一开考&随到随考/答题/倒计时/自动交卷 |
| **在线监考** | 实时状态/异常记录/强制收卷/延长时长 |
| **判分管理** | 客观题自动判/主观题人工判/成绩发布 |

#### 模块四：评价与证书 ⭐ 二期新增

| 子模块 | 说明 |
|--------|------|
| 成绩统计分析 | 分布/正确率/区分度/雷达图 |
| 证书管理 | 统一模板/唯一编号/有效期/续期/公开查询 |
| 教学质量评价 | 匿名满意度问卷/数据分析 |
| 申诉/违规管理 | 学员申诉/讲师申诉/处理流程 |

#### 模块五：学员端 ⭐ 二期新增

| 子模块 | 说明 |
|--------|------|
| 我的课程 | 课程列表/视频播放/进度跟踪 |
| 在线考试 | 待考/进行中/已完成 卡片列表 |
| 在线答题 | 逐题作答/全题型/题号导航/交卷确认 |
| 练习模式 | 不计分/即时看答案/错题本 |
| 成绩查看 | 逐题分析/错题联动教材 |
| 证书下载 | 合格证书PDF/验证二维码 |
| 学时证明 | 课程完成证明PDF |

---

## 三、一期→二期融合方案

### 核心融合原则

1. **一期功能不动代码，只加不删** — 所有现有API/页面继续工作
2. **一期数据自动兼容** — 现有试题/试卷/教材在二期升级后自动归属到默认租户和默认机构
3. **增量挂载权限** — 一期无权限控制的API逐步补上装饰器
4. **UI渐进升级** — 现有页面一期风格 → 二期按角色拆分工作台

### 具体融合点

#### 1. 试卷的"双重身份"

一期试卷→Word导出→线下使用
二期试卷→关联到考试场次→学员在线作答

**方案**：试卷表加字段 `examId`（可选），组卷完成定稿后，可直接"发布为考试"。
一期已定的试卷看 `examId = null`，走老流程（仅导出）。
二期新建的考试关联试卷，走在线考试流程。

#### 2. 试题的"分组归属"

一期试题→不分练习/考试，谁都能抽
二期试题→分练习组/考试组/通用组

**方案**：试题表加字段 `questionGroup`（PRACTICE/EXAM/COMMON，默认COMMON）
一期存量数据默认 COMMON（两边都能抽），AI出题时新增分组逻辑。

#### 3. 学员的一期→二期过渡

一期学员→独立模块，纯名单管理
二期学员→分配到班级、关联考勤、参与考试

**方案**：一期学员数据自动归属到"默认班级"的"已结业学员"分类。二期建新班时从学员库选择导入。

#### 4. LECTURER 角色的自动拆分

一期 LECTURER=能出题+能组卷+能导出
二期 LECTURER→同时赋予"出题人+组卷人"两个角色

**方案**：用户表改 `role` 单字段 → `roles` JSON 数组，兼容旧数据：
```json
// 旧：role: "LECTURER"
// 新：roles: ["QUESTION_SETTER", "PAPER_MAKER"]
// 旧数据迁移时自动展开
```

---

## 四、角色与权限体系

### 角色定义

| 角色 | 英文标识 | 定位 | 一期范围 | 二期范围 |
|------|---------|------|---------|---------|
| 超级管理员 | SUPER_ADMIN | 平台Owner | 全部 | 全部+租户管理 |
| 机构管理员 | ORG_ADMIN | 培训机构负责人 | — | 管理本机构人/班/资源 |
| 出题人 | QUESTION_SETTER | 建题库 | ✅ 出题/教材/导入 | 同上 |
| 审核人 | REVIEWER | 质量把关 | — | 审核试题/定稿试卷 |
| 组卷人 | PAPER_MAKER | 出卷 | — | 模板/组卷/编辑/导出 |
| 讲师 | LECTURER | 授课 | ✅ 缩小为"授课" | 课表/学员/被评价 |
| 班主任 | CLASS_ADVISOR | 管班 | — | 考勤/班级/学员异常 |
| 监考员 | PROCTOR | 监考 | ✅ 已有 | 按场次监考/异常处理 |
| 判卷人 | GRADER | 判主观题 | — | 只看答案判分 |
| 学员 | STUDENT | 学习考试 | — | 全部学员端功能 |

### 权限矩阵

```
权限点                  SUPER_ADMIN  ORG_ADMIN  Q_SETTER  REVIEWER  P_MAKER  LECTURER  ADVISOR  PROCTOR  GRADER  STUDENT
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
system.config           ✅           ❌         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
system.logs             ✅           ❌         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
system.tenant           ✅           ❌         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
system.dictionary       ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌

question.create         ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌
question.edit           ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌
question.delete         ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌
question.import         ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌
question.audit          ✅           ✅         ❌        ✅        ❌       ❌        ❌       ❌      ❌      ❌

material.upload         ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌
material.review         ✅           ✅         ❌        ✅        ❌       ❌        ❌       ❌      ❌      ❌
material.generate       ✅           ✅         ✅        ❌        ❌       ❌        ❌       ❌      ❌      ❌

template.manage         ✅           ✅         ❌        ❌        ✅       ❌        ❌       ❌      ❌      ❌
paper.generate          ✅           ✅         ❌        ❌        ✅       ❌        ❌       ❌      ❌      ❌
paper.edit              ✅           ✅         ❌        ❌        ✅       ❌        ❌       ❌      ❌      ❌
paper.publish           ✅           ✅         ❌        ✅        ❌       ❌        ❌       ❌      ❌      ❌
paper.download          ✅           ✅         ❌        ❌        ✅       ❌        ❌       ❌      ❌      ❌
paper.answerSheet       ✅           ✅         ❌        ❌        ✅       ❌        ❌       ❌      ❌      ❌

class.create            ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
class.edit              ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
class.delete            ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
class.view              ✅           ✅         ❌        ❌        ❌       ✅        ✅       ❌      ❌      ❌

student.create          ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
student.import          ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
student.edit            ✅           ✅         ❌        ❌        ❌       ❌        ✅       ❌      ❌      ❌
student.group           ✅           ✅         ❌        ❌        ❌       ❌        ✅       ❌      ❌      ❌

attendance.record       ✅           ✅         ❌        ❌        ❌       ❌        ✅       ❌      ❌      ❌
attendance.view         ✅           ✅         ❌        ❌        ❌       ✅        ✅       ❌      ❌      ❌

exam.create             ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
exam.edit               ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
exam.delete             ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
exam.assign             ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌

proctor.view            ✅           ✅         ❌        ❌        ❌       ❌        ❌       ✅      ❌      ❌
proctor.forceSubmit     ✅           ✅         ❌        ❌        ❌       ❌        ❌       ✅      ❌      ❌
proctor.extendTime      ✅           ✅         ❌        ❌        ❌       ❌        ❌       ✅      ❌      ❌

grading.manual          ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ✅      ❌
grading.publish         ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
grading.auto            ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌

report.view             ✅           ✅         ❌        ❌        ❌       ✅        ✅       ❌      ❌      ✅
report.export           ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌

cert.issue              ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
cert.renew              ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
cert.query              ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ✅

eval.view               ✅           ✅         ❌        ❌        ❌       ✅        ❌       ❌      ❌      ❌
eval.manage             ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌

notice.send             ✅           ✅         ❌        ❌        ❌       ❌        ✅       ❌      ❌      ❌
notice.manage           ✅           ✅         ❌        ❌        ❌       ❌        ❌       ❌      ❌      ❌
```

### 关键设计原则

1. **一人可多角色** — 用户可同时拥有多个角色，权限取并集
2. **角色模板化** — 快速分配"讲师角色"自动勾好默认权限
3. **教考分离可配置** — 系统参数控制是否开启"出题人≠审核人"校验
4. **向下兼容** — 一期单角色字段迁移到多角色数组，旧数据自动处理

---

## 五、业务流程与交互

### 流程一：培训全生命周期

```
┌─────────────────┐
│  1. 建课程体系   │ ← 机构管理员
│   • 设置科目/章节 │
│   • 上传教材     │
│   • AI出题→审核   │ ← 出题人+审核人协同
└────────┬────────┘
         ↓
┌─────────────────┐
│  2. 管理师资     │ ← 机构管理员
│   • 讲师注册/分级 │
│   • 资质管理     │
└────────┬────────┘
         ↓
┌─────────────────┐
│  3. 创建培训班   │ ← 机构管理员
│   • 填写开班信息  │
│   • 配课程/讲师   │
│   • 生成学员名单  │
│   • 配考试场次    │
└────────┬────────┘
         ↓
┌─────────────────┐
│  4. 教学实施     │ ← 多角色协同
│   • 讲师授课      │
│   • 班主任考勤    │
│   • 学员在线学习  │
└────────┬────────┘
         ↓
┌─────────────────┐
│  5. 考核评价     │ ← 多角色协同
│   • 发布考试      │ ← 机构管理员
│   • 学员在线答题  │ ← 学员
│   • 监考员监考    │ ← 监考员
│   • 判卷人判主观题│ ← 判卷人
│   • 成绩发布      │ ← 机构管理员
└────────┬────────┘
         ↓
┌─────────────────┐
│  6. 证书发放     │ ← 机构管理员
│   • 合格者发证书  │
│   • 证书公开查询  │
│   • 学员下载      │
└────────┬────────┘
         ↓
┌─────────────────┐
│  7. 质量闭环     │ ← 机构管理员
│   • 满意度问卷    │
│   • 通过率分析    │
│   • 讲师考评      │
│   • 流程改进      │
└─────────────────┘
```

### 流程二：智能组卷（一期→二期融合）

```
          一期路径                          二期路径
  ┌─────────────────┐              ┌─────────────────┐
  │ 出题人上传教材    │              │ 出题人上传教材    │
  │ AI出题→审核      │              │ AI出题→审核      │
  │ 入库             │              │ 入库             │
  └────────┬────────┘              └────────┬────────┘
           ↓                                ↓
  ┌─────────────────┐              ┌─────────────────┐
  │ 组卷人创建模板    │              │ 组卷人创建模板    │
  │ 智能组卷         │              │ 智能组卷         │
  │ 编辑/换题/定稿   │              │ 编辑/换题/定稿   │
  └────────┬────────┘              └────────┬────────┘
           ↓                                ↓
  ┌─────────────────┐              ┌─────────────────┐
  │ Word导出         │              │ 选择：            │
  │ PDF导出          │    ┌───────→ │ • 导出线下用      │
  │ 答题卡导出       │    │         │ • 发布为在线考试  │
  └─────────────────┘    │         └────────┬────────┘
                          │                  ↓
                          │         ┌─────────────────┐
                          │         │ 机构管理员        │
                          │         │ 创建考试场次      │
                          │         │ 关联试卷/配学员   │
                          │         │ 学员在线作答      │
                          └───── 两套流程并行，试卷互通
```

### 流程三：学员端导航

```
学员登录
   │
   ├─ 我的考试 ─── 待考（倒计时）→ 进入考试 → 答题 → 交卷
   │              ├ 进行中 → 继续答题
   │              └ 已完成 → 查看成绩
   │
   ├─ 我的课程 ─── 课程列表 → 视频学习 → 课时进度
   │              └ 课程完成 → 查看学时证明
   │
   ├─ 练习中心 ─── 按科目/章节选题 → 练习 → 即时看答案
   │              └ 错题本 → 重做错题
   │
   ├─ 成绩证书 ─── 历次考试成绩 → 逐题分析
   │              └ 证书列表 → 下载PDF
   │
   └─ 个人中心 ─── 修改密码/个人信息
```

---

## 六、各角色工作台

### 超级管理员工作台
```
平台总览：    机构数 | 总学员数 | 总考试场次 | 总证书数
待处理：      ⚠️ 待审核试题 N | 待定稿试卷 N | 待发证书 N
快捷入口：    系统配置 | 租户管理 | 操作日志
趋势图表：    平台使用趋势（周/月）
```

### 机构管理员工作台
```
机构概览：    培训班数 | 讲师数 | 学员数 | 考试场次
待处理：      ⚠️ 待定稿试卷 N | 待判主观题 N | 待发证书 N
快捷入口：    创建培训班 | 学员导入 | 组卷 | 证书发放
当前进行中：  进行中的培训班列表
```

### 出题人工作台
```
我的工作：    题库总题数 | 本月出题数 | 待审题数
快捷入口：    上传教材 | AI出题 | 题库管理
最近动态：    最近上传的教材处理状态
```

### 组卷人工作台
```
我的工作：    草稿试卷 N | 本月组卷数 | 可用模板数
快捷入口：    智能组卷 | 模板管理 | 草稿箱
待处理：      ⚠️ 待定稿试卷 N
```

### 班主任工作台
```
我的班级：    负责班级 N | 总学员数
今日考勤：    ⚠️ 未签到学员 N
快捷入口：    学员管理 | 考勤记录 | 班级管理
```

### 讲师工作台
```
我的课表：    今日课程 | 本周课程 | 本月
我的班级：    授课班级列表 | 学员数
待处理：      ⚠️ 待判主观题 N
我的评价：    最新教学质量评分
```

### 学员端首页
```
即将开始：    距离 N 科目考试还有 2天 3小时
进行中：      ⚠️ N 门课程进行中 | 1 场考试可继续
最新成绩：    最近一次考试得分
我的证书：    已获得 N 张证书
推荐练习：    薄弱科目推荐练习
```

---

## 七、数据库新增与变更

### Phase 1 已有表（保持不动）

| 表 | 说明 |
|----|------|
| users | 一期单角色 → 二期改 roles JSON |
| questions | 一期 → 二期加 questionGroup 字段 |
| papers | 一期 → 二期可关联考试 |
| templates | 一期保持 |
| materials/material_chapters/material_questions | 一期保持 |
| subjects/chapters | 一期保持 |
| tags | 一期保持 |
| data_dictionary | 一期保持 |
| ai_configs | 一期保持 |

### Phase 2 新增表

```prisma
// ——— 培训班 ———
model TrainingClass {
  id          Int       @id @default(autoincrement())
  name        String    // 班级名称
  code        String    // 班号（如 DT+DTM-202606-001）
  description String?
  startDate   DateTime?
  endDate     DateTime?
  status      String    // DRAFT | ENROLLING | IN_PROGRESS | FINISHED | CANCELLED
  capacity    Int?      // 人数上限
  subjectId   Int       // 关联科目
  instructors InstructorOnClass[]
  students    StudentOnClass[]
  exams       Exam[]
  createdBy   Int
  createdAt   DateTime  @default(now())
}

// ——— 讲师资源 ———
model Instructor {
  id          Int       @id @default(autoincrement())
  userId      Int?      // 关联用户（可选，讲师可能不是系统用户）
  name        String
  title       String?   // 职称
  level       String    // ASSISTANT | LECTURER | SENIOR
  channels    String?   // 准入通道（EXAM | REVIEW | DIRECT）
  certificateNo String? // 讲师证书编号
  certExpire  DateTime? // 证书有效期
  specialties String?   // 专长领域（JSON数组）
  status      String    // ACTIVE | INACTIVE | SUSPENDED
  classes     InstructorOnClass[]
  evaluations Evaluation[]
  createdAt   DateTime  @default(now())
}

// ——— 讲师与班级关联 ———
model InstructorOnClass {
  instructorId Int
  classId      Int
  role         String   // MAIN | ASSISTANT
  assignedAt   DateTime @default(now())
  @@id([instructorId, classId])
}

// ——— 学员与班级关联 ———
model StudentOnClass {
  studentId    Int
  classId      Int
  attendanceRate Float? // 出勤率
  joinedAt     DateTime @default(now())
  @@id([studentId, classId])
}

// ——— 考勤 ———
model Attendance {
  id          Int       @id @default(autoincrement())
  classId     Int
  studentId   Int
  date        DateTime
  status      String    // PRESENT | ABSENT | LEAVE | LATE
  recordedBy  Int       // 班主任
  remark      String?
  createdAt   DateTime  @default(now())
}

// ——— 考试场次（已有但需细化） ———
model Exam {
  id            Int       @id @default(autoincrement())
  title         String
  classId       Int?      // 可选：属于某培训班
  paperId       Int?      // 关联试卷
  examMode      String    // UNIFIED | FLEXIBLE（统一开考/随到随考）
  startTime     DateTime  // 开始时间
  endTime       DateTime  // 截止时间
  duration      Int       // 考试时长（分钟）
  status        String    // PENDING | IN_PROGRESS | FINISHED | CANCELLED
  maxAttempts   Int       @default(1) // 最大尝试次数
  proctorPassword String?  // 监考密码
  createdAt     DateTime  @default(now())
}

// ——— 学员答题记录（细化） ———
model ExamAnswer {
  id          Int       @id @default(autoincrement())
  examId      Int
  studentId   Int
  questionId  Int
  answer      String?   // 学员答案
  score       Float?    // 得分
  isCorrect   Boolean?  // 是否正确
  questionSnapshot Json? // 原题快照（防止试题修改影响成绩回看）
  graderId    Int?      // 判卷人
  graderNote  String?   // 判卷评语
  gradedAt    DateTime?
  createdAt   DateTime  @default(now())
}

// ——— 成绩 ———
model ExamResult {
  id           Int       @id @default(autoincrement())
  examId       Int
  studentId    Int
  totalScore   Float?
  objectiveScore Float?
  subjectiveScore Float?
  status       String    // PENDING_GRADING | GRADED | PUBLISHED
  startedAt    DateTime?
  submittedAt  DateTime?
  gradedAt     DateTime?
  publishedAt  DateTime?
}

// ——— 证书 ———
model Certificate {
  id              Int       @id @default(autoincrement())
  certNo          String    @unique  // 唯一编号
  studentId       Int
  classId         Int?
  examId          Int?
  type            String    // 合格证书 | 学时证明 | 讲师证书
  templateName    String    // 模板名称
  issueDate       DateTime  @default(now())
  expireDate      DateTime? // 有效期
  status          String    // VALID | EXPIRED | REVOKED
  publicQueryCode String?   // 公开查询验证码
  createdAt       DateTime  @default(now())
}

// ——— 教学质量评价 ———
model Evaluation {
  id            Int       @id @default(autoincrement())
  classId       Int
  instructorId  Int
  studentId     Int
  scores        Json      // 各项评分（JSON）
  comment       String?
  isAnonymous   Boolean   @default(true)
  createdAt     DateTime  @default(now())
}

// ——— 申诉 ———
model Appeal {
  id          Int       @id @default(autoincrement())
  type        String    // SCORE | EVALUATION | CERTIFICATE
  applicantId Int       // 申诉人（学员/讲师）
  targetId    Int       // 关联对象
  reason      String
  status      String    // PENDING | PROCESSING | RESOLVED | REJECTED
  handlerId   Int?
  resolution  String?
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
}

// ——— 消息通知 ———
model Notification {
  id        Int       @id @default(autoincrement())
  userId    Int
  type      String    // SYSTEM | EXAM | SCORE | REVIEW | CERT | APPEAL
  title     String
  content   String?
  isRead    Boolean   @default(false)
  targetId  Int?      // 关联业务ID（可点击跳转）
  createdAt DateTime  @default(now())
}
```

---

## 八、UI 原型方向（后续细化）

### 管理端布局

```
┌─────────┬──────────────────────────────────────┐
│ 🦊      │  工作台 / 在办事项 / 个人中心          │
│ FoxLearn │                                      │
│         │  ┌──────────────────────────────────┐ │
│ 教学资源 │  │  当前角色：出题人+组卷人            │ │
│  ├课程体系 │  │  待处理：📋 待审核试题 3          │ │
│  ├教材管理 │  │           📋 待定稿试卷 1         │ │
│  ├题库管理 │  │                                  │ │
│  ├智能组卷 │  │  快速操作                        │ │
│  ├试卷管理 │  │  [上传教材] [AI出题] [智能组卷]   │ │
│  └模板管理 │  └──────────────────────────────────┘ │
│         │                                          │
│ 培训运营 │  最近培训活动                            │
│  ├培训班  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  ├学员管理│  │DTM班│ │DTC班│ │..  │ │..  │          │
│  ├讲师管理│  └────┘ └────┘ └────┘ └────┘          │
│  ├考勤管理│                                          │
│  ├考试管理│  课程体系 → 组卷统计                     │
│  ├在线监考│  ████████░░ DTM 128道题                  │
│  └判分管理│  ██████░░░░ DTC 96道题                   │
│         │  ████░░░░░░ DTGV 64道题                   │
│ 评价证书 │                                          │
│  ├成绩统计│                                          │
│  ├证书管理│                                          │
│  ├教学质量│                                          │
│  └申诉管理│                                          │
│         │                                          │
│ 系统设置 │                                          │
│  ├权限管理│                                          │
│  ├数据字典│                                          │
│  ├操作日志│                                          │
│  └消息通知│                                          │
└─────────┴──────────────────────────────────────┘
```

### 学员端布局

```
┌────────────────────────────────────────────────┐
│       🦊 FoxLearn       [个人中心] [退出]       │
├────────────────────────────────────────────────┤
│                                                 │
│  早上好，学员姓名 ✨                             │
│                                                 │
│  📅 距离 DTM 考试还有 2天 3小时                  │
│  ⏳ 《数智化管理师》课程 60% 进行中               │
│                                                 │
│  ┌─────────┬─────────┬─────────┬─────────┐      │
│  │ 📝 考试 │ 📖 课程  │ 📚 练习  │ 🏆 证书 │      │
│  │ 待考:2  │ 进行中:3 │ 错题:12 │ 已获:1  │      │
│  │ 待查:1  │ 已完成:1 │         │         │      │
│  └─────────┴─────────┴─────────┴─────────┘      │
│                                                 │
│  最近成绩                                        │
│  ┌──────────────────────────────────────┐       │
│  │ DTM 模拟考一          85分   ✅ 通过   │       │
│  │ DTM 章节测验          72分   ✅ 通过   │       │
│  └──────────────────────────────────────┘       │
│                                                 │
│  推荐练习                                        │
│  基于你的薄弱环节：数据治理 → 推荐练习 5 题        │
│                                                 │
└────────────────────────────────────────────────┘
```

---

## 九、实施路线

### Step 1：基础加固（当前可做，备案期间）
- [ ] 给所有一期 API 补上 @RequirePermission 装饰器
- [ ] users 表 role→roles 迁移
- [ ] 问题表的 questionGroup 字段添加

### Step 2：角色体系上线
- [ ] 多角色支持（user.roles JSON）
- [ ] 权限可视化配置页
- [ ] 角色模板预置
- [ ] JWT认证替换localStorage

### Step 3：培训管理核心
- [ ] 培训班（CRUD + 状态流转）
- [ ] 讲师管理（库+分级）
- [ ] 学员管理增强（分班/分组）
- [ ] 考勤管理

### Step 4：在线考试核心
- [ ] 考试场次管理
- [ ] 学员端考试卡片/倒计时
- [ ] 在线答题（全题型）
- [ ] 客观题自动判分

### Step 5：完整闭环
- [ ] 主观题人工判分
- [ ] 成绩发布/统计分析
- [ ] 证书管理/发放
- [ ] 学员端成绩查看/证书下载

### Step 6：质量体系
- [ ] 教学质量评价
- [ ] 学员满意度调查
- [ ] 申诉管理
- [ ] 操作日志全量记录

---

## 十、开放问题（待讨论）

1. **培训班是否必须和课程体系绑定？**（一个培训班可以配多门课？还是一门课对应一个班？）
2. **考试场次是否能独立于培训班存在？**（比如不建班、直接抽题考？）
3. **讲师/出题人/组卷人是否必须注册为系统用户？**（还是可以外部管理？）
4. **证书模板是系统固定还是用户自定义？**（可以先做固定模板+替换字段）
5. **教考分离是强制校验还是可配置开关？**
6. **一期已有的 bug 清单要不要先排个优先级？**
