export const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题', ESSAY: '论文题',
};
export const DIFF_LABELS: Record<string, string> = {
  EASY: '简单', MEDIUM_EASY: '较易', MEDIUM_HARD: '较难', HARD: '困难',
};
export const AUTO_TYPES = new Set(['SINGLE_CHOICE', 'TRUE_FALSE']);
export const PROGRESS_KEY = 'foxlearn_practice_progress';

export interface SavedProgress {
  title: string;
  questionIds: number[];
  currentIdx: number;
  answers: Record<number, any>;
  results: Record<number, PracticeResult>;
  savedAt: string;
}

export interface PracticeResult {
  isCorrect: boolean;
  correctAnswer: any;
  analysis: string;
  subjective?: boolean;
}
