// 学习报告页数据类型（自 page.tsx 迁出，纯重构零行为变化）

export interface ExamTrendItem {
  examId: number;
  examTitle: string;
  totalScore: number;
  myScore: number | null;
  submittedAt: string | null;
}

export interface KpMasteryItem {
  kpId: number;
  kpName: string;
  rate: number;
  level: string;
}

export interface HoursDistItem {
  typeName: string;
  hours: number;
}

export interface WeakAreaItem {
  kpId: number;
  kpName: string;
  rate: number;
  level: string;
}

export interface DailyActivity {
  date: string;
  examCount: number;
  studyHours: number;
  videoHours: number;
  practiceCount: number;
}

export interface ProgramProgressItem {
  programId: number;
  programName: string;
  completedCourses: number;
  totalCourses: number;
  progressRate: number;
}

export interface LearningReport {
  examTrend: ExamTrendItem[];
  kpMastery: KpMasteryItem[];
  hoursDistribution: HoursDistItem[];
  weakAreas: WeakAreaItem[];
  streak: {
    totalActiveDays: number;
    currentStreak: number;
    lastActiveDate: string | null;
  };
  dailyActivity: DailyActivity[];
  recent30DayActive: number;
  programProgress: ProgramProgressItem[];
  summary: {
    passRate: number;
    passed: number;
    failed: number;
    pending: number;
    totalHours: number;
    approvedHours: number;
    pendingHours: number;
    rejectedHours: number;
    certificateCount: number;
    avgScore: number;
  };
}
