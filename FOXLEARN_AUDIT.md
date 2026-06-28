# 狐学（FoxLearn）系统完整功能清单

> 审计日期：2026-06-28  
> 项目路径：`~/projects/online-training/`  
> 前端：Next.js（`client/`）  
> 后端：NestJS（`server/`）  
> 数据库：PostgreSQL + Prisma ORM  
> 后端模块总数：42 个 Controller  
> 前端页面总数：83 个页面组件  

---

## 一、角色体系

| 角色 | 代码 | 说明 | 种子数据 |
|------|------|------|----------|
| 超级管理员 | `SUPER_ADMIN` | 系统运维，管理所有机构 | ✅ |
| 机构管理员 | `ORG_ADMIN` | 管理本机构培训业务 | ✅ |
| 讲师/出题人 | `LECTURER` | 授课、出题、批阅 | ✅ |
| 监考员 | `PROCTOR` | 考试监控、签到 | ✅ |
| 学员 | `STUDENT` | 学习、考试、查成绩 | ✅ |
| 审计员 | `AUDITOR` | 只读查看 + 报表导出 | ✅ |
| **招生机构管理员** | `AGENCY_ADMIN` | 招生机构管理员（代码已定义，未在 seed 中创建） | ❌ |
| **考务员** | `EXAM_OFFICER` | 负责组卷/考试/判分/成绩发布（代码已定义，未在 seed 中创建） | ❌ |

**注：** AGENCY_ADMIN 和 EXAM_OFFICER 在权限常量文件中完整定义了角色及权限映射，前端 sidebar 也有对应菜单显示逻辑，但 seed 脚本未创建这两个角色的默认记录。

---

## 二、权限点完整列表（共 56 个）

### 2.1 系统管理（4）
| 权限键 | 含义 |
|--------|------|
| `system:config` | 系统配置 |
| `system:logs` | 系统日志 |
| `system:tenant` | 租户管理 |
| `system:dictionary` | 数据字典 |

### 2.2 题库管理（5）
| 权限键 | 含义 |
|--------|------|
| `question:create` | 创建题目 |
| `question:edit` | 编辑题目 |
| `question:delete` | 删除题目 |
| `question:import` | 导入题目 |
| `question:audit` | 审核题目 |

### 2.3 组卷管理（6）
| 权限键 | 含义 |
|--------|------|
| `paper:view` | 查看试卷 |
| `paper:generate` | 智能组卷 |
| `paper:edit` | 编辑试卷 |
| `paper:publish` | 发布试卷 |
| `paper:download` | 下载试卷 |
| `paper:answer_sheet` | 查看答题卡 |
| `template:manage` | 管理组卷模板 |

### 2.4 考试管理（5）
| 权限键 | 含义 |
|--------|------|
| `exam:create` | 创建考试 |
| `exam:edit` | 编辑考试 |
| `exam:delete` | 删除考试 |
| `exam:assign` | 分配考试 |
| `exam:view` | 查看考试 |
| `exam:result:view` | 查看成绩 |
| `appeal:manage` | 管理申诉 |

### 2.5 监考（3）
| 权限键 | 含义 |
|--------|------|
| `proctor:view` | 监考监控 |
| `proctor:force_submit` | 强制交卷 |
| `proctor:extend_time` | 延长考试时间 |

### 2.6 判分（3）
| 权限键 | 含义 |
|--------|------|
| `grading:auto` | 自动判分 |
| `grading:manual` | 手动判分 |
| `grading:publish` | 发布成绩 |

### 2.7 学员管理（5）
| 权限键 | 含义 |
|--------|------|
| `student:view` | 查看学员列表 |
| `student:create` | 创建学员 |
| `student:import` | 批量导入学员 |
| `student:edit` | 编辑学员 |
| `student:group` | 管理学员分组 |
| `student:reset_pwd` | 重置学员密码 |

### 2.8 成绩/报表（2）
| 权限键 | 含义 |
|--------|------|
| `report:view` | 查看报表 |
| `report:export` | 导出报表 |

### 2.9 教材出题（3）
| 权限键 | 含义 |
|--------|------|
| `material:upload` | 上传教材 |
| `material:review` | 审核教材 |
| `material:generate` | 教材出题 |

### 2.10 消息通知（3）
| 权限键 | 含义 |
|--------|------|
| `notice:send` | 发送通知 |
| `notice:manage` | 管理通知 |
| `notification:view` | 查看消息 |

### 2.11 证书管理（3）
| 权限键 | 含义 |
|--------|------|
| `cert:issue` | 发放证书 |
| `cert:revoke` | 吊销证书 |
| `cert:view` | 查看证书 |

### 2.12 培训班管理（5）
| 权限键 | 含义 |
|--------|------|
| `program:view` | 查看培训班 |
| `program:create` | 创建培训班 |
| `program:edit` | 编辑培训班 |
| `program:delete` | 删除培训班 |
| `program:enroll` | 学员报名 |

### 2.13 招生机构（7）
| 权限键 | 含义 |
|--------|------|
| `agency:view` | 查看招生机构 |
| `agency:view:students` | 查看招生机构学员 |
| `agency:manage:students` | 管理招生机构学员 |
| `agency:manage:certificates` | 管理招生机构证书 |
| `agency:create` | 创建招生机构 |
| `agency:edit` | 编辑招生机构 |
| `agency:delete` | 删除招生机构 |

### 2.14 证书审批（3）
| 权限键 | 含义 |
|--------|------|
| `cert:approve` | 审批证书申请 |
| `cert:reject` | 驳回证书申请 |
| `cert:application_view` | 查看证书申请 |

### 2.15 成绩单（1）
| 权限键 | 含义 |
|--------|------|
| `transcript:view` | 查看成绩单 |

### 2.16 讲师管理（4）
| 权限键 | 含义 |
|--------|------|
| `instructor:view` | 查看讲师 |
| `instructor:create` | 创建讲师 |
| `instructor:edit` | 编辑讲师 |
| `instructor:delete` | 删除讲师 |

### 2.17 课程管理（4）
| 权限键 | 含义 |
|--------|------|
| `course:view` | 查看课程 |
| `course:create` | 创建课程 |
| `course:edit` | 编辑课程 |
| `course:delete` | 删除课程 |

### 2.18 排课管理（4）
| 权限键 | 含义 |
|--------|------|
| `schedule:view` | 查看排课 |
| `schedule:create` | 创建排课 |
| `schedule:edit` | 编辑排课 |
| `schedule:delete` | 删除排课 |

### 2.19 机构管理（4）
| 权限键 | 含义 |
|--------|------|
| `org:view` | 查看机构 |
| `org:create` | 创建机构 |
| `org:edit` | 编辑机构 |
| `org:delete` | 删除机构 |

### 2.20 角色权限管理（4）
| 权限键 | 含义 |
|--------|------|
| `role:view` | 查看角色 |
| `role:create` | 创建角色 |
| `role:edit` | 编辑角色 |
| `role:delete` | 删除角色 |

### 2.21 学时管理（3）
| 权限键 | 含义 |
|--------|------|
| `learningHour:view` | 查看学时 |
| `learningHour:manage` | 管理学时 |
| `learningHour:approve` | 审核学时 |

### 2.22 评价管理（2）
| 权限键 | 含义 |
|--------|------|
| `evaluation:view` | 查看评价 |
| `evaluation:manage` | 管理评价 |

### 2.23 AI 配置（2）
| 权限键 | 含义 |
|--------|------|
| `aiConfig:view` | 查看 AI 配置 |
| `aiConfig:manage` | 管理 AI 配置 |

### 2.24 审计日志（1）
| 权限键 | 含义 |
|--------|------|
| `auditLog:view` | 查看审计日志 |

---

## 三、角色 ↔ 权限映射摘要

| 角色 | 权限数 | 核心权限范围 |
|------|--------|------------|
| **SUPER_ADMIN** | 56（全部） | 一切权限 |
| **ORG_ADMIN** | ~50 | 除 SYSTEM_TENANT 外的几乎所有管理权限 |
| **LECTURER** | ~16 | 出题、组卷、判分、教材、查看报表/证书/课程 |
| **PROCTOR** | 3 | 监考监控、强制交卷、延长考试时间 |
| **STUDENT** | 7 | 课程查看、考试查看、学时查看、证书查看、消息、评价、报表 |
| **EXAM_OFFICER** | ~27 | 题库、组卷、考试、阅卷、监考、申诉、证书、教材、报表 |
| **AGENCY_ADMIN** | 6 | 招生机构自身管理、学员管理、证书管理、学时管理、消息 |
| **AUDITOR** | 9 | 成绩查看、证书查看/申请、成绩单、培训班、排课、报表/导出、审计日志、学时、评价 |

---

## 四、后端 API 端点完整清单（42 个 Controller）

### 4.1 认证模块（`auth`）

**AuthController** (`/api/auth`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 公开 | 登录 |
| POST | `/api/auth/register` | 公开 | 注册 |
| GET | `/api/auth/captcha` | 公开 | 获取验证码 |

**UserProfileController** (`/api/user`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/user/profile` | 需登录 | 获取个人信息 |
| PUT | `/api/user/profile` | 需登录 | 更新个人信息 |
| GET | `/api/user/permissions` | 需登录 | 获取当前用户权限 |
| POST | `/api/user/password` | 需登录 | 修改密码 |

### 4.2 题库模块

**SubjectsController** (`/api/subjects`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/subjects` | 公开 | 获取所有科目 |
| POST | `/api/subjects` | `system:dictionary` | 创建科目 |
| PUT | `/api/subjects/:id` | `system:dictionary` | 编辑科目 |
| DELETE | `/api/subjects/:id` | `system:dictionary` | 删除科目 |

**ChaptersController** (`/api/chapters`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/chapters` | 公开 | 获取所有章节（按subjectId筛选） |
| POST | `/api/chapters` | `system:dictionary` | 创建章节 |
| PUT | `/api/chapters/:id` | `system:dictionary` | 编辑章节 |
| DELETE | `/api/chapters/:id` | `system:dictionary` | 删除章节 |

**QuestionsController** (`/api/questions`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/questions` | `question:create` | 获取题目列表 |
| GET | `/api/questions/:id` | `question:create` | 获取单题详情 |
| POST | `/api/questions` | `question:create` | 创建题目 |
| POST | `/api/questions/batch` | `question:import` | 批量导入题目 |
| PUT | `/api/questions/:id` | `question:edit` | 编辑题目 |
| DELETE | `/api/questions/:id` | `question:delete` | 删除题目 |
| POST | `/api/questions/:id/audit` | `question:audit` | 审核题目 |

**TagsController** (`/api/tags`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/tags` | `question:create` | 获取标签列表 |
| POST | `/api/tags` | `question:create` | 创建标签 |
| PUT | `/api/tags/:id` | `question:edit` | 编辑标签 |
| DELETE | `/api/tags/:id` | `question:delete` | 删除标签 |

**MaterialsController** (`/api/materials`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/materials` | `question:create` | 获取教材列表 |
| POST | `/api/materials` | `material:upload` | 上传教材 |
| GET | `/api/materials/:id` | `question:create` | 查看教材详情 |
| DELETE | `/api/materials/:id` | `material:upload` | 删除教材 |
| POST | `/api/materials/:id/generate` | `material:generate` | 从教材生成题目 |

**DataDictionaryController** (`/api/data-dictionaries`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/data-dictionaries` | 公开 | 获取字典列表 |
| POST | `/api/data-dictionaries` | `system:dictionary` | 创建字典项 |
| PUT | `/api/data-dictionaries/:id` | `system:dictionary` | 编辑字典项 |
| DELETE | `/api/data-dictionaries/:id` | `system:dictionary` | 删除字典项 |

### 4.3 组卷模块

**TemplatesController** (`/api/templates`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/templates` | `template:manage` | 获取组卷模板列表 |
| POST | `/api/templates` | `template:manage` | 创建组卷模板 |
| PUT | `/api/templates/:id` | `template:manage` | 编辑组卷模板 |
| DELETE | `/api/templates/:id` | `template:manage` | 删除组卷模板 |

**PapersController** (`/api/papers`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/papers` | `paper:view` | 获取试卷列表 |
| GET | `/api/papers/:id` | `paper:view` | 查看试卷详情 |
| POST | `/api/papers` | `paper:generate` | 智能组卷 |
| PUT | `/api/papers/:id` | `paper:edit` | 编辑试卷 |
| DELETE | `/api/papers/:id` | `paper:edit` | 删除试卷 |
| PUT | `/api/papers/:id/publish` | `paper:publish` | 发布试卷 |
| GET | `/api/papers/:id/download` | `paper:download` | 下载试卷（Word） |
| GET | `/api/papers/:id/answer-sheet` | `paper:answer_sheet` | 查看/下载答题卡 |

### 4.4 考试模块（5 个 Controller）

**ExamsController** (`/api/exams`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/exams` | `exam:create` | 获取考试列表 |
| GET | `/api/exams/:id` | `exam:create` | 查看考试详情 |
| POST | `/api/exams` | `exam:create` | 创建考试 |
| PUT | `/api/exams/:id` | `exam:edit` | 编辑考试 |
| DELETE | `/api/exams/:id` | `exam:delete` | 删除考试 |
| PUT | `/api/exams/:id/publish` | `exam:create` | 发布考试 |
| PUT | `/api/exams/:id/finish` | `exam:edit` | 结束考试 |
| GET | `/api/exams/:id/students` | `exam:create` | 查看考试分配的学员 |
| POST | `/api/exams/:id/add-students` | `exam:assign` | 分配学员到考试 |
| GET | `/api/exams/:id/grading-progress` | `grading:manual` | 阅卷进度 |
| GET | `/api/exams/:id/sessions/status-summary` | `grading:manual` | 考试状态汇总 |
| GET | `/api/exams/:id/transcript` | `transcript:view` | 成绩单 |
| GET | `/api/exams/:id/results` | `exam:result:view` | 考试成绩 |
| GET | `/api/exams/:id/results/:studentId` | `exam:result:view` | 单个学员成绩详情 |
| GET | `/api/exams/:id/appeals` | `appeal:manage` | 查看申诉列表 |
| PATCH | `/api/exams/:id/appeals/:appealId` | `appeal:manage` | 处理申诉 |
| POST | `/api/exams/:id/publish-scores` | `exam:result:view` | 发布成绩 |

**StudentExamController** (`/api/student`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/student/exams` | 需登录 | 学员待考列表 |
| GET | `/api/student/exams/:examId` | 需登录 | 学员考试详情 |
| POST | `/api/student/exams/:examId/start` | 需登录 | 开始考试 |
| POST | `/api/student/exams/:examId/submit` | 需登录 | 提交答卷 |
| GET | `/api/student/exams/:examId/result` | 需登录 | 查看考试成绩 |

**ProctoringController** (`/api/proctor`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/proctor/exams` | `proctor:view` | 监考考试列表 |
| GET | `/api/proctor/exams/:examId/sessions` | `proctor:view` | 考试会话列表 |
| POST | `/api/proctor/exams/:examId/force-submit` | `proctor:force_submit` | 强制交卷 |
| POST | `/api/proctor/exams/:examId/extend-time` | `proctor:extend_time` | 延长考试时间 |

**GradingController** (`/api/grading`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/grading/assignments` | `grading:manual` | 获取判分任务 |
| GET | `/api/grading/assignments/:id` | `grading:manual` | 查看判分任务详情 |
| POST | `/api/grading/assignments/:id/score` | `grading:manual` | 提交评分 |
| POST | `/api/grading/auto-grade/:examId` | `grading:auto` | 自动判分 |
| POST | `/api/grading/publish/:examId` | `grading:publish` | 发布成绩 |

**GradingAssignmentController** (`/api/grading-assignments`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/grading-assignments` | `grading:manual` | 分配阅卷任务 |
| GET | `/api/grading-assignments/:examId` | `grading:manual` | 查看阅卷分配情况 |

**ScoreAppealController** (`/api/exams`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/exams/:examId/appeals` | 需登录（学员） | 提交申诉 |
| GET | `/api/exams/:examId/appeals` | `grading:manual` | 管理员查看申诉 |
| GET | `/api/exams/appeals/my` | 需登录 | 学员查看自己的申诉 |
| PATCH | `/api/exams/appeals/:id/review` | `grading:manual` | 审核申诉 |

**ReviewController** (`/api/grading-reviews`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/grading-reviews/:examId` | `grading:manual` | 查看复核列表 |
| POST | `/api/grading-reviews/:examId/request` | `grading:manual` | 申请复核 |
| POST | `/api/grading-reviews/:examId/:reviewId/resolve` | `grading:manual` | 处理复核 |

**TranscriptController** (`/api/exams`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/exams/:examId/transcript` | `transcript:view` | 获取成绩单 |

**ExamAnalysisController** (`/api/exams`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/exams/:id/analysis/overview` | `report:view` | 考试分析概览 |
| GET | `/api/exams/:id/analysis/distribution` | `report:view` | 分数分布 |
| GET | `/api/exams/:id/analysis/question-accuracy` | `report:view` | 题目正确率分析 |

### 4.5 培训班模块

**TrainingProgramsController** (`/api/programs`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/programs` | `program:view` | 培训班列表（含分页+筛选） |
| GET | `/api/programs/:id` | `program:view` | 培训班详情 |
| POST | `/api/programs` | `program:create` | 创建培训班 |
| PUT | `/api/programs/:id` | `program:edit` | 编辑培训班 |
| DELETE | `/api/programs/:id` | `program:delete` | 删除培训班 |
| PUT | `/api/programs/:id/status` | `program:edit` | 变更培训班状态 |
| GET | `/api/programs/:id/status-logs` | `program:view` | 状态变更日志 |
| GET | `/api/programs/:id/statistics` | `program:view` | 培训班统计 |
| POST | `/api/programs/:id/students` | `program:enroll` | 添加学员到培训班 |
| DELETE | `/api/programs/:id/students/:studentId` | `program:enroll` | 移除培训班学员 |
| GET | `/api/programs/:id/learning-hours` | `learningHour:view` | 培训班学时 |
| GET | `/api/programs/:id/attendance` | `program:view` | 培训班考勤 |
| PUT | `/api/programs/:id/attendance` | `program:edit` | 更新出勤 |
| POST | `/api/programs/:id/business-evidence` | `program:edit` | 上传业务证据 |

### 4.6 学生/学员模块

**StudentsController** (`/api/students`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/students` | `student:view` | 学员列表（分页+筛选） |
| GET | `/api/students/:id` | `student:view` | 学员详情 |
| POST | `/api/students` | `student:create` | 创建学员 |
| PUT | `/api/students/:id` | `student:edit` | 编辑学员信息 |
| DELETE | `/api/students/:id` | `student:edit` | 删除学员 |
| POST | `/api/students/import` | `student:import` | 批量导入学员 |
| POST | `/api/students/import/preview` | `student:import` | 预览导入 |
| POST | `/api/students/:id/reset-password` | `student:reset_pwd` | 重置学员密码 |

### 4.7 讲师模块

**InstructorsController** (`/api/instructors`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/instructors` | `instructor:view` | 讲师列表 |
| GET | `/api/instructors/:id` | `instructor:view` | 讲师详情 |
| POST | `/api/instructors` | `instructor:create` | 创建讲师 |
| PUT | `/api/instructors/:id` | `instructor:edit` | 编辑讲师 |
| DELETE | `/api/instructors/:id` | `instructor:delete` | 删除讲师 |

### 4.8 课程模块

**CoursesController** (`/api/courses`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/courses` | `course:view` | 课程列表 |
| GET | `/api/courses/:id` | `course:view` | 课程详情 |
| POST | `/api/courses` | `course:create` | 创建课程 |
| PUT | `/api/courses/:id` | `course:edit` | 编辑课程 |
| DELETE | `/api/courses/:id` | `course:delete` | 删除课程 |

**CourseVideosController** (`/api/courses/:courseId/videos`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/courses/:courseId/videos` | `course:view` | 获取课程视频列表 |
| GET | `/api/courses/:courseId/videos/:id` | `course:view` | 视频详情 |
| POST | `/api/courses/:courseId/videos` | `course:edit` | 创建视频记录 |
| PUT | `/api/courses/:courseId/videos/:id` | `course:edit` | 编辑视频 |
| DELETE | `/api/courses/:courseId/videos/:id` | `course:edit` | 删除视频 |
| PUT | `/api/courses/:courseId/videos/reorder` | `course:edit` | 视频排序 |
| POST | `/api/courses/:courseId/videos/upload` | `course:edit` | 上传视频文件 |
| GET | `/api/courses/:courseId/videos/:id/stream` | `course:view` | 视频流播放 |
| GET | `/api/courses/:courseId/videos/:id/progress` | 需登录 | 获取播放进度 |
| POST | `/api/courses/:courseId/videos/:id/progress` | 需登录 | 上报播放进度 |

**SchedulesController** (`/api/schedules`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/schedules` | `schedule:view` | 排课列表（分页+筛选） |
| GET | `/api/schedules/:id` | `schedule:view` | 排课详情 |
| POST | `/api/schedules` | `schedule:create` | 创建排课 |
| PUT | `/api/schedules/:id` | `schedule:edit` | 编辑排课 |
| DELETE | `/api/schedules/:id` | `schedule:delete` | 删除排课 |

**VideoCoursesController** (`/api/video-courses`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/video-courses` | `course:view` | 视频课程列表 |
| GET | `/api/video-courses/:id` | `course:view` | 视频课程详情 |
| POST | `/api/video-courses` | `course:create` | 创建视频课程 |
| PUT | `/api/video-courses/:id` | `course:edit` | 编辑视频课程 |
| DELETE | `/api/video-courses/:id` | `course:delete` | 删除视频课程 |
| PUT | `/api/video-courses/:id/publish` | `course:edit` | 发布视频课程 |
| PUT | `/api/video-courses/:id/unpublish` | `course:edit` | 取消发布 |
| POST | `/api/video-courses/:id/upload` | `course:edit` | 上传视频文件 |
| GET | `/api/video-courses/:id/stream` | `course:view` | 视频流播放 |
| PUT | `/api/video-courses/:id/log` | `course:edit` | 记录操作日志 |
| GET | `/api/video-courses/:id/logs` | `course:view` | 获取操作日志 |
| GET | `/api/video-courses/public` | 公开 | 公共视频课程列表 |
| POST | `/api/video-courses/:id/progress` | 需登录 | 上报播放进度 |
| GET | `/api/video-courses/:id/progress` | 需登录 | 获取播放进度 |

### 4.9 证书模块

**CertificatesController** (`/api/certificates`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/certificates` | `cert:view` | 证书列表 |
| GET | `/api/certificates/:id` | `cert:view` | 证书详情 |
| POST | `/api/certificates` | `cert:issue` | 发放证书 |
| DELETE | `/api/certificates/:id` | `cert:revoke` | 吊销证书 |
| POST | `/api/certificates/:id/reissue` | `cert:issue` | 补发证书 |
| POST | `/api/certificates/:id/approve` | `cert:approve` | 审批通过 |
| POST | `/api/certificates/:id/reject` | `cert:reject` | 审批驳回 |
| GET | `/api/certificates/applications` | `cert:application_view` | 证书申请列表 |
| GET | `/api/certificates/verify/:certNo` | 公开 | 证书验证（防伪查询） |

### 4.10 招生机构模块

**EnrollmentAgenciesController** (`/api/enrollment-agencies`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/enrollment-agencies` | `agency:view` | 招生机构列表 |
| GET | `/api/enrollment-agencies/:id` | `agency:view` | 机构详情 |
| POST | `/api/enrollment-agencies` | `agency:create` | 创建机构 |
| PUT | `/api/enrollment-agencies/:id` | `agency:edit` | 编辑机构 |
| DELETE | `/api/enrollment-agencies/:id` | `agency:delete` | 删除机构 |

### 4.11 评价模块

**EvaluationsController** (`/api/evaluations`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/evaluations` | `evaluation:view` | 评价列表 |
| POST | `/api/evaluations` | `evaluation:manage` | 创建评价 |
| GET | `/api/evaluations/:id` | `evaluation:view` | 评价详情 |

### 4.12 学时模块

**LearningHoursController** (`/api/learning-hours`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/learning-hours` | `learningHour:view` | 学时记录列表 |
| POST | `/api/learning-hours` | `learningHour:manage` | 创建学时记录 |
| PUT | `/api/learning-hours/:id` | `learningHour:manage` | 编辑学时记录 |
| DELETE | `/api/learning-hours/:id` | `learningHour:manage` | 删除学时记录 |
| POST | `/api/learning-hours/:id/approve` | `learningHour:approve` | 审核通过 |
| POST | `/api/learning-hours/:id/reject` | `learningHour:approve` | 审核驳回 |

### 4.13 备案模块

**FilingController** (`/api/filing`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/filing` | `program:edit` | 提交开班备案 |
| GET | `/api/filing` | `program:view` | 备案列表 |
| PUT | `/api/filing/:id/review` | `program:edit` | 审核备案 |

### 4.14 系统管理模块

**OrganizationsController** (`/api/organizations`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/organizations` | `org:view` | 机构列表 |
| GET | `/api/organizations/:id` | `org:view` | 机构详情 |
| POST | `/api/organizations` | `org:create` | 创建机构 |
| PUT | `/api/organizations/:id` | `org:edit` | 编辑机构 |
| DELETE | `/api/organizations/:id` | `org:delete` | 删除机构 |

**UsersController** (`/api/users`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/users` | `role:view` | 用户列表 |
| GET | `/api/users/:id` | `role:view` | 用户详情 |
| POST | `/api/users` | `role:create` | 创建用户 |
| PUT | `/api/users/:id` | `role:edit` | 编辑用户 |
| DELETE | `/api/users/:id` | `role:delete` | 删除用户 |

**PermissionsController** (`/api/permissions`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/permissions/roles` | `role:view` | 获取角色列表 |
| GET | `/api/permissions/roles/:id` | `role:view` | 角色详情 |
| POST | `/api/permissions/roles` | `role:create` | 创建角色 |
| PUT | `/api/permissions/roles/:id` | `role:edit` | 编辑角色 |
| DELETE | `/api/permissions/roles/:id` | `role:delete` | 删除角色 |
| PUT | `/api/permissions/roles/:id/permissions` | `role:edit` | 更新角色权限 |
| GET | `/api/permissions/users/:userId/roles` | `role:view` | 获取用户角色 |
| PUT | `/api/permissions/users/:userId/roles` | `role:edit` | 分配用户角色 |

**DashboardController** (`/api/dashboard`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/dashboard/stats` | 需登录 | 仪表盘统计 |

**SiteSettingsController** (`/api/site-settings`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/site-settings` | 公开 | 获取站点设置 |
| PUT | `/api/site-settings` | `system:config` | 更新站点设置 |
| POST | `/api/site-settings/upload-logo` | `system:config` | 上传Logo/图标 |

**NotificationsController** (`/api/notifications`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/notifications` | `notification:view` | 消息列表 |
| GET | `/api/notifications/unread-count` | `notification:view` | 未读消息数 |
| PUT | `/api/notifications/:id/read` | `notification:view` | 标记已读 |
| POST | `/api/notifications` | `notice:send` | 发送通知 |

**AiConfigController** (`/api/ai-configs`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/ai-configs` | `system:config` | AI配置列表 |
| POST | `/api/ai-configs` | `system:config` | 创建AI配置 |
| PUT | `/api/ai-configs/:id` | `system:config` | 编辑AI配置 |
| DELETE | `/api/ai-configs/:id` | `system:config` | 删除AI配置 |
| POST | `/api/ai-configs/test` | `system:config` | 测试AI连接 |

**AuditLogsController** (`/api/audit-logs`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/audit-logs` | `auditLog:view` | 审计日志列表 |

**KnowledgeController** (`/api/knowledge`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/knowledge` | `question:create` | 知识库列表 |
| GET | `/api/knowledge/:id` | `question:create` | 知识条目详情 |
| POST | `/api/knowledge` | `question:create` | 创建知识条目 |
| PUT | `/api/knowledge/:id` | `question:edit` | 编辑知识条目 |
| DELETE | `/api/knowledge/:id` | `question:delete` | 删除知识条目 |

**DataImportExportController** (`/api/data-import-export`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/data-import-export/import` | 按模块 | 通用导入 |
| GET | `/api/data-import-export/import/logs` | `report:view` | 导入日志 |
| POST | `/api/data-import-export/export` | `report:export` | 通用导出 |
| GET | `/api/data-import-export/export/logs` | `report:view` | 导出日志 |

**AttachmentsController** (`/api/attachments`)
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/attachments/upload` | 需登录 | 上传附件 |
| GET | `/api/attachments/:id` | 需登录 | 下载附件 |
| DELETE | `/api/attachments/:id` | 需登录 | 删除附件 |

---

## 五、前端页面完整清单（83 个页面组件）

### 5.1 公共/通用页面

| 路由 | 文件 | 功能描述 | 访问角色 |
|------|------|----------|----------|
| `/` | `page.tsx` | 根路由，自动跳转至 /dashboard 或 /login | 全部 |
| `/login` | `login/page.tsx` | 登录页（验证码 + 密码登录） | 全部 |
| `/register` | `register/page.tsx` | 用户注册 | 公开 |
| `/dashboard` | `dashboard/page.tsx` | 仪表盘（管理员/学员双视图） | 全部 |
| `/my/profile` | `my/profile/page.tsx` | 个人资料编辑 | 登录用户 |
| `/settings` | `settings/page.tsx` | 个人设置 | 登录用户 |
| `/notifications` | `notifications/page.tsx` | 消息通知列表 | 全部 |
| `/verify-certificate` | `verify-certificate/page.tsx` | 证书验证（防伪查询） | 公开 |

### 5.2 题库管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/questions` | `questions/page.tsx` | 题目列表/管理/批量导入 | ADMIN/LECTURER/EXAM_OFFICER |
| `/questions` (组件) | `components/question-modals.tsx` | 题目CRUD弹窗 | 同上 |
| `/questions` (组件) | `components/question-import-modal.tsx` | 批量导入弹窗 | 同上 |
| `/materials` | `materials/page.tsx` | 教材列表（PDF上传 → AI出题） | ADMIN/LECTURER/EXAM_OFFICER |
| `/materials/[id]` | `materials/[id]/page.tsx` | 教材详情 | 同上 |
| `/admin/knowledge` | `admin/knowledge/page.tsx` | 知识库管理 | ADMIN/EXAM_OFFICER |

### 5.3 组卷管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/papers` | `papers/page.tsx` | 试卷列表 | ADMIN/EXAM_OFFICER |
| `/papers/[id]` | `papers/[id]/page.tsx` | 试卷详情/预览 | 同上 |
| `/generate` | `generate/page.tsx` | 智能组卷（参数配置→自动生成） | 同上 |
| `/templates` | — | 组卷模板管理（API 已实现，前端路由待确认） | 同上 |

### 5.4 考试管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/exams` | `exams/page.tsx` | 考试列表 | ADMIN/EXAM_OFFICER |
| `/exams/create` | `exams/create/page.tsx` | 创建考试 | ADMIN/EXAM_OFFICER |
| `/exams/[id]` | `exams/[id]/page.tsx` | 考试详情 | ADMIN/EXAM_OFFICER |
| `/exams/[id]/analysis` | `exams/[id]/analysis/page.tsx` | 考试分析（概览+分布+正确率） | ADMIN/EXAM_OFFICER |
| `/exams/[id]/transcript` | `exams/[id]/transcript/page.tsx` | 成绩单 | ADMIN/EXAM_OFFICER |
| `/exams/[id]/appeal` | `exams/[id]/appeal/page.tsx` | 申诉详情 | ADMIN/LECTURER |
| `/exams/appeals` | `exams/appeals/page.tsx` | 申诉列表 | ADMIN/LECTURER |
| `/exam` | `exam/page.tsx` | 学员考试中心 | STUDENT |
| `/exam/take/[id]` | `exam/take/[id]/page.tsx` | 学员在线考试 | STUDENT |
| `/exam/result/[id]` | `exam/result/[id]/page.tsx` | 学员考试成绩 | STUDENT |
| `/exam/results` | `exam/results/page.tsx` | 学员成绩列表 | STUDENT |

### 5.5 监考管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/proctoring` | `proctoring/page.tsx` | 监考考试列表 | PROCTOR/ADMIN |
| `/proctoring/[examId]` | `proctoring/[examId]/page.tsx` | 监考详情（考生列表+操作） | PROCTOR/ADMIN |

### 5.6 阅卷管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/grading` | `grading/page.tsx` | 阅卷任务列表 | LECTURER/ADMIN/EXAM_OFFICER |
| `/grading/[examId]` | `grading/[examId]/page.tsx` | 阅卷详情/评分 | 同上 |
| `/grading/[examId]/assign` | `grading/[examId]/assign/page.tsx` | 阅卷任务分配 | ADMIN/EXAM_OFFICER |

### 5.7 学员管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/students` | `students/page.tsx` | 学员列表/管理 | ADMIN/EXAM_OFFICER |
| `/students/[id]` | `students/[id]/page.tsx` | 学员详情 | 同上 |
| `/students` (组件) | `students/import-modal.tsx` | 批量导入学员 | ADMIN |
| `/accounts` | `accounts/page.tsx` | 账号管理 | ADMIN |

### 5.8 培训班管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/programs` | `programs/page.tsx` | 培训班列表 | ADMIN/EXAM_OFFICER |
| `/programs/new` | `programs/new/page.tsx` | 创建培训班 | ADMIN |
| `/programs/[id]` | `programs/[id]/page.tsx` | 培训班详情（含学员/考勤/统计） | ADMIN/EXAM_OFFICER |
| `/programs/[id]/hours-tab` | `programs/[id]/hours-tab.tsx` | 培训班学时管理 | ADMIN |
| `/programs/[id]/evaluate` | `programs/[id]/evaluate/page.tsx` | 培训班评价 | STUDENT |

### 5.9 课程/视频管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/courses` | `courses/page.tsx` | 课程列表 | ADMIN/LECTURER |
| `/courses/new` | `courses/new/page.tsx` | 创建课程 | ADMIN |
| `/courses/[id]` | `courses/[id]/page.tsx` | 课程详情 | ADMIN/LECTURER |
| `/courses/[id]/edit` | `courses/[id]/edit/page.tsx` | 编辑课程 | ADMIN |
| `/courses/[id]/videos` | `courses/[id]/videos/page.tsx` | 课程视频列表 | ADMIN/LECTURER |
| `/courses/[id]/videos/[videoId]/play` | `courses/[id]/videos/[videoId]/play/page.tsx` | 视频播放 | ADMIN/LECTURER/STUDENT |
| `/admin/video-courses` | `admin/video-courses/page.tsx` | 视频课程管理 | ADMIN |
| `/video/[id]` | `video/[id]/page.tsx` | 视频播放页 | 全部 |
| `/learning-center` | `learning-center/page.tsx` | 学习中心 | STUDENT |
| `/learning-center/[id]/play` | `learning-center/[id]/play/page.tsx` | 学员视频播放 | STUDENT |

### 5.10 讲师管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/instructors` | `instructors/page.tsx` | 讲师列表 | ADMIN |
| `/instructors/new` | `instructors/new/page.tsx` | 创建讲师 | ADMIN |
| `/instructors/[id]` | `instructors/[id]/page.tsx` | 讲师详情 | ADMIN |
| `/instructors/[id]/edit` | `instructors/[id]/edit/page.tsx` | 编辑讲师 | ADMIN |
| `/instructors/[id]/evaluations` | `instructors/[id]/evaluations/page.tsx` | 讲师评价 | ADMIN |

### 5.11 证书管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/certificates` | `certificates/page.tsx` | 证书列表/发放 | ADMIN/EXAM_OFFICER |
| `/certificates/applications` | `certificates/applications/page.tsx` | 证书申请审批 | ADMIN/EXAM_OFFICER |
| `/my-certificates` | `my-certificates/page.tsx` | 我的证书 | STUDENT |

### 5.12 学时管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/learning-hours` | `learning-hours/page.tsx` | 学时记录/申报 | STUDENT/ADMIN |
| `/admin/learning-hours-review` | `admin/learning-hours-review/page.tsx` | 学时审核 | ADMIN/AGENCY_ADMIN |

### 5.13 实践/练习

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/practice` | `practice/page.tsx` | 练习中心 | STUDENT |
| `/practice/chapter` | `practice/chapter/page.tsx` | 章节练习 | STUDENT |
| `/practice/random` | `practice/random/page.tsx` | 随机练习 | STUDENT |
| `/practice/wrong` | `practice/wrong/page.tsx` | 错题本 | STUDENT |
| `/practice/favorite` | `practice/favorite/page.tsx` | 收藏题目 | STUDENT |

### 5.14 评价管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/evaluations` | `evaluations/page.tsx` | 评价管理 | ADMIN |
| (内嵌) | `components/appeal-dialog.tsx` | 申诉提交对话框 | STUDENT |

### 5.15 AI 功能

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/admin/ai-configs` | `admin/ai-configs/page.tsx` | AI 配置管理 | ADMIN |
| `/ai/assistant` | `ai/assistant/page.tsx` | AI 智能助手 | 全部 |

### 5.16 招生机构

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/agencies` | `agencies/page.tsx` | 招生机构管理 | ADMIN |
| `/admin/agency-students` | `admin/agency-students/page.tsx` | 招生机构学员管理 | AGENCY_ADMIN |

### 5.17 系统管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/admin/organizations` | `admin/organizations/page.tsx` | 机构管理 | ADMIN |
| `/admin/settings/branding` | `admin/settings/branding/page.tsx` | 品牌设置 | ADMIN |
| `/admin/data` | `admin/data/page.tsx` | 数据字典 | ADMIN |
| `/admin/audit-trail` | `admin/audit-trail/page.tsx` | 审计日志 | ADMIN/AUDITOR |
| `/admin/messages` | `admin/messages/page.tsx` | 消息管理 | ADMIN |
| `/permissions` | `permissions/page.tsx` | 角色权限管理 | ADMIN |
| `/prototypes` | `prototypes/page.tsx` | 原型页面 | 开发 |
| `/prototypes/online-exam` | `prototypes/online-exam/page.tsx` | 在线考试原型 | 开发 |
| `/prototypes/student-exams` | `prototypes/student-exams/page.tsx` | 学员考试原型 | 开发 |
| `/prototypes/exam-sessions` | `prototypes/exam-sessions/page.tsx` | 考试会话原型 | 开发 |

### 5.18 备案管理

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/admin/filing` | `admin/filing/page.tsx` | 开班备案审批 | ADMIN |

### 5.19 考试成绩管理（管理端）

| 路由 | 文件 | 功能描述 | 管理端角色 |
|------|------|----------|------------|
| `/admin/exam-results/[id]` | `admin/exam-results/[id]/page.tsx` | 考试成绩列表 | ADMIN/EXAM_OFFICER |
| `/admin/exam-results/[id]/student/[studentId]` | `admin/exam-results/[id]/student/[studentId]/page.tsx` | 学员成绩详情 | ADMIN/EXAM_OFFICER |

---

## 六、数据库模型清单（Prisma Schema）

| 模型 | 表名 | 功能描述 |
|------|------|----------|
| `User` | `users` | 用户（学员/管理员/讲师等） |
| `Role` | `roles` | 角色定义 |
| `UserRoleAssignment` | `user_role_assignments` | 用户-角色关联（多对多） |
| `RolePermission` | `role_permissions` | 角色-权限关联 |
| `Organization` | `organizations` | 组织机构 |
| `DataDictionary` | `data_dictionaries` | 数据字典（课程分类等） |
| `Subject` | `subjects` | 科目 |
| `Chapter` | `chapters` | 章节 |
| `Tag` | `tags` | 标签（领域标签） |
| `Question` | `questions` | 题目 |
| `QuestionOption` | `question_options` | 题目选项 |
| `Paper` | `papers` | 试卷 |
| `PaperQuestion` | `paper_questions` | 试卷-题目关联 |
| `Template` | `templates` | 组卷模板 |
| `TemplateQuestionRule` | `template_question_rules` | 模板题目规则 |
| `Exam` | `exams` | 考试 |
| `ExamSession` | `exam_sessions` | 考试会话（学员答题记录） |
| `ExamAnswer` | `exam_answers` | 答案记录 |
| `ManualGradingAssignment` | `manual_grading_assignments` | 手动判分分配 |
| `GradingReview` | `grading_reviews` | 阅卷复核 |
| `ScoreAppeal` | `score_appeals` | 成绩申诉 |
| `GradingLock` | `grading_locks` | 判分锁定 |
| `TrainingProgram` | `training_programs` | 培训班 |
| `ProgramStatusLog` | `program_status_logs` | 培训班状态变更日志 |
| `ProgramStudent` | `program_students` | 培训班学员关联 |
| `Schedule` | `schedules` | 排课 |
| `Course` | `courses` | 课程 |
| `CourseVideo` | `course_videos` | 课程视频（旧，即将废弃） |
| `VideoCourse` | `video_courses` | 视频课程（新，独立实体） |
| `VideoCourseCourse` | `video_course_courses` | 视频课程-课程多对多关联 |
| `VideoCourseLog` | `video_course_logs` | 视频课程操作日志 |
| `VideoProgress` | `video_progresses` | 视频播放进度 |
| `LearningHourRecord` | `learning_hour_records` | 学时记录 |
| `Instructor` | `instructors` | 讲师 |
| `Certificate` | `certificates` | 证书 |
| `CertificateTemplate` | `certificate_templates` | 证书模板 |
| `CertificateTrace` | `certificate_traces` | 证书追溯 |
| `EnrollmentAgency` | `enrollment_agencies` | 招生机构 |
| `EnrollmentAgencyEnrollment` | `enrollment_agency_enrollments` | 招生机构备案 |
| `Evaluation` | `evaluations` | 评价 |
| `EvaluationInstructorRating` | `evaluation_instructor_ratings` | 讲师评分明细 |
| `SiteSetting` | `site_settings` | 站点设置（品牌） |
| `Notification` | `notifications` | 消息通知 |
| `AiConfig` | `ai_configs` | AI 配置 |
| `AuditLog` | `audit_logs` | 审计日志 |
| `ImportLog` | `import_logs` | 导入日志 |
| `ExportLog` | `export_logs` | 导出日志 |
| `BusinessEvidence` | `business_evidences` | 业务证据（签到/线下） |
| `AttendanceRecord` | `attendance_records` | 出勤记录 |
| `Material` | `materials` | 教材 |
| `QuestionFavorite` | `question_favorites` | 收藏题目 |
| `PracticeRecord` | `practice_records` | 练习记录（错题本） |
| `Attachment` | `attachments` | 附件 |

**总计：53 个数据模型**

---

## 七、特殊功能概述

### 7.1 教考分离
- 教师（LECTURER）负责授课，不能独立创建/管理考试（只有 EXAM_CREATE/EXAM_EDIT 权限，但考试由 EXAM_OFFICER 或 ADMIN 统筹）
- 阅卷分配（`GradingAssignmentController`）支持将试卷分配给不同讲师批阅
- 阅卷复核（`ReviewController`）支持对已批阅题目申请复核，实现"判-审分离"

### 7.2 学时申报与审核
- **学员端**：`/learning-hours` 页面可申报学时（填写课时、提交证明材料）
- **管理端**：`/admin/learning-hours-review` 可审核/驳回学时记录
- 数据库 `LearningHourRecord` 模型含 `status(PENDING|APPROVED|REJECTED)`、`evidenceUrl`、`reviewComment` 等字段
- 权限：`learningHour:manage`（申报）、`learningHour:approve`（审核）
- AGENCY_ADMIN 角色也拥有 `learningHour:manage` 权限

### 7.3 证书审批流程
- 学员可查看自己的证书 `/my-certificates`
- 证书申请列表 `/certificates/applications` 供管理员审批
- API：`POST /certificates/:id/approve` 和 `POST /certificates/:id/reject`
- 证书防伪验证：`GET /certificates/verify/:certNo`（公开接口，无需登录）
- 证书追溯：`CertificateTrace` 模型记录每次发放/吊销操作

### 7.4 招生机构体系
- `EnrollmentAgency` 模型管理招生机构基本信息
- `AGENCY_ADMIN` 角色（代码已定义，种子未创建）拥有学员管理、证书管理、学时管理等权限
- `EnrollmentAgencyEnrollment` 模型（开班备案）与培训机构对接
- 前端页面：`/agencies`（管理端）、`/admin/agency-students`（机构管理员端）

### 7.5 培训班状态流转
- `TrainingProgram` 支持复杂状态机：`PREPARING → ENROLLING → IN_PROGRESS → REVIEWING → CERTIFYING → COMPLETED`（含 CANCELLED）
- 每次状态变更记录到 `ProgramStatusLog`
- 支持学员报名、分配、移除、考勤、业务证据上传

### 7.6 在线考试完整闭环
1. 组卷（Template → Paper 智能生成）
2. 创建考试（Exam）、分配学员（assign students）
3. 学员在线答题（StudentExamController）
4. 监考监控（ProctoringController）
5. 自动判分 + 手动阅卷分配（GradingController + GradingAssignmentController）
6. 成绩发布（publish-scores）
7. 成绩单/分析（TranscriptController + ExamAnalysisController）
8. 成绩申诉（ScoreAppealController）
9. 阅卷复核（ReviewController）
10. 证书发放（CertificateController）

### 7.7 AI 功能
- AI 配置管理（`AiConfig` 模型 + `/api/ai-configs` API）
- 教材出题（`POST /materials/:id/generate` — 上传PDF后用AI生成题目）
- AI 智能助手（前端 `/ai/assistant` 页面）
- 智能组卷（`/generate` 页面配置参数，调用 Paper 生成）

### 7.8 数据导入导出
- 通用导入导出框架（`DataImportExportController`）
- 支持学员批量导入（`POST /students/import` + preview）
- 题目批量导入（`POST /questions/batch`）
- 导入/导出日志记录（`ImportLog` / `ExportLog`）

---

## 八、架构亮点与待完善项

### 架构亮点
1. **细粒度权限体系**：56 个权限点 + 8 个角色 + 角色-权限映射表 + 全局 `PermissionGuard` 守卫
2. **全局权限守卫**：`PermissionGuard` 以 `APP_GUARD` 全局注册，每个 Controller 使用 `@RequirePermission` 装饰器控制
3. **模块化清晰**：42 个 Controller 按业务领域拆分，符合 NestJS 模块化最佳实践
4. **双前端视图**：dashboard 同时对管理员和学员展示不同视图
5. **支持公开注册/登录**：验证码 + 站点设置控制是否开放注册
6. **品牌可定制**：`SiteSetting` 支持站点名称、Logo、favicon、ICP 备案号等

### 待完善项
1. **AGENCY_ADMIN 和 EXAM_OFFICER 角色未在 seed 中初始化**
2. **部分前端路由缺少布局/权限守卫**（如 prototypes 页面）
3. **CourseVideo 模型标注"即将废弃"但仍有前端页面引用**
4. **视频流播放使用本地文件系统存储**（非 CDN/OSS 方案）
5. **部分权限点未在任一 API Controller 中使用**（如 `STUDENT_VIEW`、`SYSTEM_TENANT`）
