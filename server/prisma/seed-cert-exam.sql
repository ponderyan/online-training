-- ═══════════════════════════════════════════════════════════════
-- 认证考试示例数据 Seed
-- 说明：ITSS 服务标准认证考试 + 示例学员 session
-- 可安全重复执行（INSERT IGNORE）
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 创建 ITSS 科目和数据字典 ──
INSERT IGNORE INTO `data_dictionaries` (`id`, `code`, `name`, `sort_order`, `is_active`, `created_at`)
VALUES (100, 'ITSS', 'ITSS服务标准认证', 99, 1, NOW());

INSERT IGNORE INTO `subjects` (`id`, `name`, `code`, `dictionary_id`, `sort_order`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (100, 'ITSS 服务标准', 'ITSS', 100, 99, 'ITSS 信息技术服务标准认证科目', 1, NOW(), NOW());

-- ── 2. 创建章节 ──
INSERT IGNORE INTO `chapters` (`id`, `subject_id`, `name`, `sort_order`, `created_at`, `updated_at`)
VALUES
  (100, 100, 'ITSS 标准体系概述', 1, NOW(), NOW()),
  (101, 100, '服务战略与规划设计', 2, NOW(), NOW()),
  (102, 100, '服务部署与实施', 3, NOW(), NOW()),
  (103, 100, '服务运营与持续改进', 4, NOW(), NOW()),
  (104, 100, 'ITIL 最佳实践', 5, NOW(), NOW());

-- ── 3. 创建试题（15 道单选题 + 5 道多选题 + 5 道判断题 = 25 题，共 100 分）──
-- 单选题（每题 4 分，15 题 = 60 分）
INSERT IGNORE INTO `questions` (`id`, `subject_id`, `chapter_id`, `type`, `content`, `analysis`, `difficulty`, `source`, `status`, `usage_count`, `created_at`, `updated_at`)
VALUES
  (1001, 100, 100, 'SINGLE_CHOICE', 'ITSS 的全称是什么？', 'ITSS 是 Information Technology Service Standards 的缩写', 'EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1002, 100, 100, 'SINGLE_CHOICE', '以下哪个不是 ITSS 的核心组成要素？', '市场营销不属于 ITSS 核心要素，ITSS 核心要素包括人员、流程、技术和资源', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1003, 100, 100, 'SINGLE_CHOICE', 'ITSS 标准体系中的"四要素"是指？', 'ITSS 的四要素为人员(People)、流程(Process)、技术(Technology)和资源(Resource)', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1004, 100, 100, 'SINGLE_CHOICE', 'ITSS 适用于哪些类型的组织？', 'ITSS 适用于所有类型的组织，包括 IT 服务提供方和需求方', 'EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1005, 100, 101, 'SINGLE_CHOICE', 'IT 服务战略规划的首要步骤是什么？', 'IT 服务战略规划首先需要明确业务目标和服务愿景', 'MEDIUM_HARD', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1006, 100, 101, 'SINGLE_CHOICE', '服务级别协议（SLA）的主要作用是？', 'SLA 用于明确 IT 服务提供方与客户之间的服务范围和标准', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1007, 100, 101, 'SINGLE_CHOICE', '以下哪项是 IT 服务设计中最关键的活动？', '服务目录管理是服务设计的核心，定义了服务的范围和内容', 'MEDIUM_HARD', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1008, 100, 101, 'SINGLE_CHOICE', '容量管理的主要目标是什么？', '容量管理确保 IT 服务的性能满足当前和未来的业务需求', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1009, 100, 102, 'SINGLE_CHOICE', '在 IT 服务部署中，变更管理的主要目的是？', '变更管理确保所有变更经过评估、审批和实施，降低风险', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1010, 100, 102, 'SINGLE_CHOICE', '发布管理中的"发布单元"是指？', '发布单元是发布中可独立部署的 IT 组件集合', 'HARD', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1011, 100, 102, 'SINGLE_CHOICE', '配置管理数据库（CMDB）的核心作用是什么？', 'CMDB 存储和管理所有 IT 基础设施配置项的信息及其关系', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1012, 100, 103, 'SINGLE_CHOICE', '事件管理中的"事件"是指？', '事件是 IT 服务运行中发生的任何可检测或可感知的现象', 'EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1013, 100, 103, 'SINGLE_CHOICE', '问题管理与事件管理的区别是什么？', '事件管理关注快速恢复服务，问题管理关注根因分析', 'MEDIUM_HARD', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1014, 100, 103, 'SINGLE_CHOICE', '持续服务改进（CSI）采用的核心模型是什么？', 'CSI 采用 PDCA（计划-执行-检查-改进）循环模型', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW()),
  (1015, 100, 104, 'SINGLE_CHOICE', 'ITIL 4 中"服务价值系统"（SVS）包含多少个组件？', 'ITIL 4 SVS 包含 5 个组件：指导原则、治理、服务价值链、实践和持续改进', 'HARD', 'MANUAL', 'PUBLISHED', 0, NOW(), NOW());

-- 单选题选项
INSERT IGNORE INTO `question_options` (`id`, `question_id`, `label`, `content`, `is_correct`, `sort_order`) VALUES
  (10001, 1001, 'A', 'Information Technology Service Standards', 1, 0),
  (10002, 1001, 'B', 'Internet Technology Security System', 0, 1),
  (10003, 1001, 'C', 'Integrated Telecom Service Standard', 0, 2),
  (10004, 1001, 'D', 'Information Technology Support Service', 0, 3),
  (10005, 1002, 'A', '人员', 0, 0),
  (10006, 1002, 'B', '流程', 0, 1),
  (10007, 1002, 'C', '市场营销', 1, 2),
  (10008, 1002, 'D', '资源', 0, 3),
  (10009, 1003, 'A', '人、财、物、技术', 0, 0),
  (10010, 1003, 'B', '人员、流程、技术、资源', 1, 1),
  (10011, 1003, 'C', '战略、运营、支持、改进', 0, 2),
  (10012, 1003, 'D', '设计、转换、交付、改进', 0, 3),
  (10013, 1004, 'A', '仅 IT 服务提供方', 0, 0),
  (10014, 1004, 'B', '仅大型企业', 0, 1),
  (10015, 1004, 'C', '所有类型的组织', 1, 2),
  (10016, 1004, 'D', '仅政府机构', 0, 3),
  (10017, 1005, 'A', '制定预算', 0, 0),
  (10018, 1005, 'B', '明确业务目标和服务愿景', 1, 1),
  (10019, 1005, 'C', '选择技术平台', 0, 2),
  (10020, 1005, 'D', '组建团队', 0, 3),
  (10021, 1006, 'A', '记录技术参数', 0, 0),
  (10022, 1006, 'B', '明确服务范围和标准', 1, 1),
  (10023, 1006, 'C', '管理 IT 预算', 0, 2),
  (10024, 1006, 'D', '分配技术人员', 0, 3),
  (10025, 1007, 'A', '技术选型', 0, 0),
  (10026, 1007, 'B', '服务目录管理', 1, 1),
  (10027, 1007, 'C', '人员招聘', 0, 2),
  (10028, 1007, 'D', '采购硬件', 0, 3),
  (10029, 1008, 'A', '降低成本', 0, 0),
  (10030, 1008, 'B', '确保服务性能满足业务需求', 1, 1),
  (10031, 1008, 'C', '增加服务种类', 0, 2),
  (10032, 1008, 'D', '缩减团队规模', 0, 3),
  (10033, 1009, 'A', '加快部署速度', 0, 0),
  (10034, 1009, 'B', '降低变更风险', 1, 1),
  (10035, 1009, 'C', '减少 IT 投入', 0, 2),
  (10036, 1009, 'D', '简化技术架构', 0, 3),
  (10037, 1010, 'A', '最小的可独立部署的 IT 组件集合', 1, 0),
  (10038, 1010, 'B', '一个完整的 IT 系统', 0, 1),
  (10039, 1010, 'C', '一组硬件设备', 0, 2),
  (10040, 1010, 'D', '所有软件更新', 0, 3),
  (10041, 1011, 'A', '记录 IT 支出', 0, 0),
  (10042, 1011, 'B', '存储配置项及关系', 1, 1),
  (10043, 1011, 'C', '管理用户密码', 0, 2),
  (10044, 1011, 'D', '监控网络流量', 0, 3),
  (10045, 1012, 'A', '重大故障', 0, 0),
  (10046, 1012, 'B', '可检测或可感知的现象', 1, 1),
  (10047, 1012, 'C', '用户投诉', 0, 2),
  (10048, 1012, 'D', '系统崩溃', 0, 3),
  (10049, 1013, 'A', '没有区别', 0, 0),
  (10050, 1013, 'B', '事件管理关注根因，问题管理关注恢复', 0, 1),
  (10051, 1013, 'C', '事件管理关注恢复，问题管理关注根因', 1, 2),
  (10052, 1013, 'D', '事件管理由用户发起，问题管理由 IT 发起', 0, 3),
  (10053, 1014, 'A', '瀑布模型', 0, 0),
  (10054, 1014, 'B', 'PDCA 循环', 1, 1),
  (10055, 1014, 'C', '敏捷开发', 0, 2),
  (10056, 1014, 'D', 'V 模型', 0, 3),
  (10057, 1015, 'A', '3 个', 0, 0),
  (10058, 1015, 'B', '4 个', 0, 1),
  (10059, 1015, 'C', '5 个', 1, 2),
  (10060, 1015, 'D', '6 个', 0, 3);

-- 多选题（每题 4 分，5 题 = 20 分）
INSERT IGNORE INTO `questions` (`id`, `subject_id`, `chapter_id`, `type`, `content`, `analysis`, `difficulty`, `source`, `status`, `created_at`, `updated_at`)
VALUES
  (1016, 100, 100, 'MULTIPLE_CHOICE', 'ITSS 的服务分类包括以下哪些？（多选）', 'ITSS 将 IT 服务分为咨询服务、运维服务、集成实施服务等多个类别', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1017, 100, 101, 'MULTIPLE_CHOICE', '以下哪些属于 IT 服务战略规划的关键活动？（多选）', '服务战略规划包括分析业务需求、评估现有能力、制定服务策略等', 'MEDIUM_HARD', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1018, 100, 102, 'MULTIPLE_CHOICE', 'IT 服务部署阶段包括哪些关键流程？（多选）', '部署阶段包括变更管理、发布管理、配置管理等', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1019, 100, 103, 'MULTIPLE_CHOICE', '服务运营阶段的流程包括以下哪些？（多选）', '服务运营包括事件管理、问题管理、服务台等', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1020, 100, 104, 'MULTIPLE_CHOICE', 'ITIL 4 的指导原则包括哪些？（多选）', 'ITIL 4 的 7 条指导原则包括关注价值、从现状出发等', 'HARD', 'MANUAL', 'PUBLISHED', NOW(), NOW());

INSERT IGNORE INTO `question_options` (`id`, `question_id`, `label`, `content`, `is_correct`, `sort_order`) VALUES
  (10061, 1016, 'A', 'IT 咨询服务', 1, 0), (10062, 1016, 'B', 'IT 运维服务', 1, 1),
  (10063, 1016, 'C', '硬件销售', 0, 2), (10064, 1016, 'D', '集成实施服务', 1, 3),
  (10065, 1016, 'E', '软件授权销售', 0, 4),
  (10066, 1017, 'A', '分析业务需求', 1, 0), (10067, 1017, 'B', '评估现有 IT 服务能力', 1, 1),
  (10068, 1017, 'C', '购买最新设备', 0, 2), (10069, 1017, 'D', '制定服务策略和路线图', 1, 3),
  (10070, 1017, 'E', '裁减 IT 团队', 0, 4),
  (10071, 1018, 'A', '变更管理', 1, 0), (10072, 1018, 'B', '发布管理', 1, 1),
  (10073, 1018, 'C', '财务管理', 0, 2), (10074, 1018, 'D', '配置管理', 1, 3),
  (10075, 1018, 'E', '项目管理', 0, 4),
  (10076, 1019, 'A', '事件管理', 1, 0), (10077, 1019, 'B', '问题管理', 1, 1),
  (10078, 1019, 'C', '软件开发', 0, 2), (10079, 1019, 'D', '服务台', 1, 3),
  (10080, 1019, 'E', '市场营销', 0, 4),
  (10081, 1020, 'A', '关注价值', 1, 0), (10082, 1020, 'B', '从现状出发', 1, 1),
  (10083, 1020, 'C', '以最低成本实施', 0, 2), (10084, 1020, 'D', '利用反馈迭代推进', 1, 3),
  (10085, 1020, 'E', '保持简单实用', 1, 4);

-- 判断题（每题 4 分，5 题 = 20 分）
INSERT IGNORE INTO `questions` (`id`, `subject_id`, `chapter_id`, `type`, `content`, `analysis`, `difficulty`, `source`, `status`, `created_at`, `updated_at`)
VALUES
  (1021, 100, 100, 'TRUE_FALSE', 'ITSS 是强制性国家标准，所有 IT 企业必须强制执行。', 'ITSS 是推荐性行业标准，非强制性', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1022, 100, 101, 'TRUE_FALSE', '服务级别协议（SLA）只需要定义服务范围，不需要约定服务指标。', 'SLA 必须包含具体的服务指标和考核标准', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1023, 100, 102, 'TRUE_FALSE', '变更管理委员会（CAB）负责审批所有 IT 变更。', 'CAB 通常审批重大或高风险变更，低风险变更有简化流程', 'MEDIUM_HARD', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1024, 100, 103, 'TRUE_FALSE', '事件管理的主要目标是找到问题的根本原因。', '事件管理目标是快速恢复服务，根因分析是问题管理的职责', 'MEDIUM_EASY', 'MANUAL', 'PUBLISHED', NOW(), NOW()),
  (1025, 100, 104, 'TRUE_FALSE', 'ITIL 4 的服务价值链包含"计划、改进、驱动、设计、转换、获取/构建、交付与支持"共 7 个活动。', 'ITIL 4 服务价值链包含计划、改进、驱动、设计与转换、获取/构建、交付与支持共 6 个活动', 'HARD', 'MANUAL', 'PUBLISHED', NOW(), NOW());

-- ── 4. 创建认证试卷 ──
INSERT IGNORE INTO `papers` (`id`, `name`, `paper_number`, `subject_id`, `total_score`, `duration_minutes`, `is_open_book`, `status`, `created_by`, `finalized_at`, `created_at`, `updated_at`)
VALUES (100, 'ITSS 服务标准认证考试', 'CERT-ITSS-20260701-001', 100, 100, 60, 0, 'FINALIZED', 1, NOW(), NOW(), NOW());

-- 将试题关联到试卷
INSERT IGNORE INTO `paper_questions` (`paper_id`, `question_id`, `sort_order`, `score`, `type_section`) VALUES
  -- 单选题 1-15（每题 4 分，60 分）
  (100, 1001, 1, 4, 'SINGLE_CHOICE'), (100, 1002, 2, 4, 'SINGLE_CHOICE'),
  (100, 1003, 3, 4, 'SINGLE_CHOICE'), (100, 1004, 4, 4, 'SINGLE_CHOICE'),
  (100, 1005, 5, 4, 'SINGLE_CHOICE'), (100, 1006, 6, 4, 'SINGLE_CHOICE'),
  (100, 1007, 7, 4, 'SINGLE_CHOICE'), (100, 1008, 8, 4, 'SINGLE_CHOICE'),
  (100, 1009, 9, 4, 'SINGLE_CHOICE'), (100, 1010, 10, 4, 'SINGLE_CHOICE'),
  (100, 1011, 11, 4, 'SINGLE_CHOICE'), (100, 1012, 12, 4, 'SINGLE_CHOICE'),
  (100, 1013, 13, 4, 'SINGLE_CHOICE'), (100, 1014, 14, 4, 'SINGLE_CHOICE'),
  (100, 1015, 15, 4, 'SINGLE_CHOICE'),
  -- 多选题 16-20（每题 4 分，20 分）
  (100, 1016, 16, 4, 'MULTIPLE_CHOICE'), (100, 1017, 17, 4, 'MULTIPLE_CHOICE'),
  (100, 1018, 18, 4, 'MULTIPLE_CHOICE'), (100, 1019, 19, 4, 'MULTIPLE_CHOICE'),
  (100, 1020, 20, 4, 'MULTIPLE_CHOICE'),
  -- 判断题 21-25（每题 4 分，20 分）
  (100, 1021, 21, 4, 'TRUE_FALSE'), (100, 1022, 22, 4, 'TRUE_FALSE'),
  (100, 1023, 23, 4, 'TRUE_FALSE'), (100, 1024, 24, 4, 'TRUE_FALSE'),
  (100, 1025, 25, 4, 'TRUE_FALSE');

-- ── 5. 创建认证考试（配置认证模式参数）──
INSERT IGNORE INTO `exams` (`id`, `title`, `paper_id`, `start_time`, `end_time`, `duration_minutes`, `access_type`, `max_attempts`, `is_open_book`, `late_entry_minutes`, `early_exit_minutes`, `shuffle_questions`, `shuffle_options`, `status`, `passing_score`, `max_retake_attempts`, `retake_window_days`, `created_by`, `created_at`, `updated_at`)
VALUES (100, 'ITSS 服务标准认证（模拟）', 100, '2026-07-11 00:00:00.000', '2026-12-31 23:59:59.000', 60, 'UNIFIED', 3, 0, 10, 0, 1, 1, 'PUBLISHED', 75, 2, 30, 1, NOW(), NOW());

-- ── 6. 创建机构 + 培训班 ──
INSERT IGNORE INTO `organizations` (`id`, `name`, `code`, `is_active`, `created_at`, `updated_at`)
VALUES (100, 'ITSS 认证中心', 'CERT-ITSS', 1, NOW(), NOW());

INSERT IGNORE INTO `training_programs` (`id`, `name`, `code`, `course_name`, `org_id`, `start_date`, `end_date`, `enroll_start`, `enroll_end`, `subject_id`, `created_by`, `status`, `created_at`, `updated_at`)
VALUES (100, 'ITSS 服务标准认证培训', 'PROG-CERT-ITSS', 'ITSS 服务标准认证', 100, '2026-07-01 00:00:00.000', '2026-12-31 23:59:59.000', '2026-06-01 00:00:00.000', '2026-12-30 23:59:59.000', 100, 1, 'IN_PROGRESS', NOW(), NOW());

-- 更新考试关联培训班
UPDATE `exams` SET `program_id` = 100 WHERE `id` = 100;

-- ── 7. 分配示例学员 ──
-- 为 stu001 (id=2) 和 stu002 (id=3) 创建 exam_sessions
INSERT IGNORE INTO `exam_sessions` (`exam_id`, `student_id`, `status`, `remaining_time`, `suspicion_level`, `created_at`, `updated_at`, `last_heartbeat_at`)
VALUES
  (100, 2, 'ACTIVE', 1500, 0, NOW(), NOW(), NOW()),
  (100, 3, 'ACTIVE', 1800, 0, NOW(), NOW(), NOW());
