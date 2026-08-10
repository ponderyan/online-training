/**
 * 批量导入试题 — 配置常量与类型定义
 */

export const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题', ESSAY: '论文题',
};
export const ALL_TYPES = Object.keys(TYPE_NAMES);

export const DIFF_MAP: Record<string, string> = {
  '易': 'EASY', '较易': 'MEDIUM_EASY', '较难': 'MEDIUM_HARD', '难': 'HARD',
  'EASY': 'EASY', 'MEDIUM_EASY': 'MEDIUM_EASY', 'MEDIUM_HARD': 'MEDIUM_HARD', 'HARD': 'HARD',
};

export const MAX_IMPORT_COUNT = 300; // 单次最大导入题数

export const TYPE_SHEETS: Record<string, { headers: string[]; sample: string[]; colMap: string[] }> = {
  SINGLE_CHOICE: {
    headers: ['题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '正确答案', '难度', '章节名称', '解析'],
    sample: ['数据治理的核心目标是什么？', '提高系统性能', '保障数据安全', '降低存储成本', '提升用户体验', '', '', 'B', '易', '数据治理概述', '保障数据的安全性和可用性。'],
    colMap: ['content', 'opt0', 'opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'correct', 'difficulty', 'chapter', 'analysis'],
  },
  MULTIPLE_CHOICE: {
    headers: ['题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '正确答案', '难度', '章节名称', '解析'],
    sample: ['以下哪些属于数据质量维度？', '完整性', '一致性', '准确性', '及时性', '可访问性', '安全性', 'A,B,C,D', '较易', '数据质量管理', '数据质量六大维度。'],
    colMap: ['content', 'opt0', 'opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'correct', 'difficulty', 'chapter', 'analysis'],
  },
  TRUE_FALSE: {
    headers: ['题干', '正确答案', '难度', '章节名称', '解析'],
    sample: ['数据仓库只需要存储结构化数据。', '错误', '较易', '数据仓库基础', '数据仓库可存储结构化、半结构化和非结构化数据。'],
    colMap: ['content', 'correct', 'difficulty', 'chapter', 'analysis'],
  },
  FILL_BLANK: {
    headers: ['题干', '填空答案', '难度', '章节名称', '解析'],
    sample: ['数据治理三大核心要素是{{_}}、{{_}}和{{_}}。', '组织架构;管理制度;技术平台', '较难', '数据治理体系', '组织是基础，制度是保障，技术是手段。'],
    colMap: ['content', 'blankAnswers', 'difficulty', 'chapter', 'analysis'],
  },
  SHORT_ANSWER: {
    headers: ['题干', '参考答案', '难度', '章节名称', '解析'],
    sample: ['请简述数据生命周期管理的主要阶段。', '规划、采集、存储、使用、共享、归档、销毁', '难', '数据生命周期', '七个阶段缺一不可。'],
    colMap: ['content', 'analysis', 'difficulty', 'chapter', 'extraAnalysis'],
  },
  ESSAY: {
    headers: ['题干（论文题目）', '评分要点', '难度', '章节名称', '解析'],
    sample: ['试论述数据治理体系建设的关键要素与实施路径。', '论点明确（30%）；论据充分（30%）；结构清晰（20%）；结论合理（20%）', '难', '数据治理实施', '需覆盖组织、制度、技术、运营四个维度。'],
    colMap: ['content', 'analysis', 'difficulty', 'chapter', 'extraAnalysis'],
  },
  CASE_STUDY: {
    headers: ['题干（案例场景）', '子问题', '子问题答案', '难度', '章节名称', '解析'],
    sample: ['某企业数据标准不统一，导致无法有效共享。', '原因分析|解决方案', '缺乏标准|建立数据标准体系', '难', '数据治理实施', '需建立企业级数据标准体系。'],
    colMap: ['content', 'subQuestions', 'subAnswers', 'difficulty', 'chapter', 'analysis'],
  },
};

export interface ParsedRow {
  sheetType: string;
  content: string;
  options: string[];
  correctAnswer: string;
  difficulty: string;
  chapterName: string;
  analysis: string;
  blankAnswers: string;
  subQuestions: string;
  subAnswers: string;
  errors: string[];
}
