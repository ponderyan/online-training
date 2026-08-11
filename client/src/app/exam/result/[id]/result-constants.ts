export interface AnswerDetail {
  questionId: number;
  yourAnswer: any;
  correctAnswer: any;
  isCorrect: boolean | null;
  score: number | null;
  graderNote: string | null;
  questionContent: string;
  questionType: string;
  options: { label: string; content: string }[];
  analysis: string | null;
}

export interface ExamResult {
  examTitle: string;
  paperName: string;
  totalScore: number | null;
  subjectiveScore: number | null;
  finalScore: number | null;
  isPassed: boolean | null;
  submittedAt: string;
  published?: boolean;
  message?: string;
  answers: AnswerDetail[];
}

export interface KpInfo {
  id: number;
  name: string;
  code: string | null;
}

export interface KpAnalysisItem {
  kpId: number;
  kpName: string;
  kpCode: string;
  totalQuestions: number;
  correct: number;
  rate: number;
  level: string;
}

export interface KpAnalysisData {
  kpResults: KpAnalysisItem[];
  questionKps: Record<number, KpInfo[]>;
  overallRate: number;
  weakest: { kpId: number; kpName: string; rate: number } | null;
  strongest: { kpId: number; kpName: string; rate: number } | null;
}

export const LEVEL_COLORS: Record<string, string> = {
  '优秀': 'var(--sage)',
  '良好': 'var(--sage-light)',
  '一般': 'var(--gold)',
  '薄弱': 'var(--verm)',
  '危险': 'var(--verm)',
};

export const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题', ESSAY: '论文题',
};

export function formatAnswer(a: AnswerDetail): string {
  if (a.questionType === 'MULTIPLE_CHOICE' && Array.isArray(a.yourAnswer)) return a.yourAnswer.join(', ');
  if (a.questionType === 'FILL_BLANK' && Array.isArray(a.yourAnswer)) return a.yourAnswer.map((v: string, i: number) => `空${i + 1}: ${v}`).join('; ');
  return String(a.yourAnswer ?? '未作答');
}

export function formatCorrect(a: AnswerDetail): string {
  if (a.questionType === 'MULTIPLE_CHOICE' && Array.isArray(a.correctAnswer)) return a.correctAnswer.join(', ');
  if (a.questionType === 'FILL_BLANK' && Array.isArray(a.correctAnswer)) return a.correctAnswer.map((v: string, i: number) => `空${i + 1}: ${v}`).join('; ');
  return String(a.correctAnswer ?? '-');
}
