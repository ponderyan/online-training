'use client';

/**
 * 教材五步 Pipeline 进度条
 * 步骤：①上传 → ②识别 → ③复核章节 → ④出题 → ⑤审核入库
 */
const STEPS = [
  { key: 'upload', label: '上传' },
  { key: 'recognize', label: '识别' },
  { key: 'review', label: '复核' },
  { key: 'generate', label: '出题' },
  { key: 'audit', label: '审核' },
];

/**
 * 根据教材状态计算当前步骤
 * returns { currentStep: number; completedSteps: number }
 */
export function getPipelineStep(status: string, hasChapters: boolean, totalQuestions: number): { current: number; completed: number } {
  const steps = {
    UPLOADED: { current: 0, completed: 0 },
    PROCESSING: { current: 1, completed: 1 },
    OCR_DONE: hasChapters ? { current: 2, completed: 2 } : { current: 1, completed: 1 },
    STRUCTURED: { current: 3, completed: 3 },
    GENERATING: { current: 3, completed: 3 },
    GENERATED: { current: 4, completed: 4 },
    REVIEWING: { current: 4, completed: 4 },
    COMPLETED: { current: 5, completed: 5 },
  };
  return (steps as any)[status] || { current: 0, completed: 0 };
}

export default function PipelineProgress({ status, hasChapters, totalQuestions, archived, size = 'sm' }: {
  status: string;
  hasChapters: boolean;
  totalQuestions: number;
  archived?: boolean;
  size?: 'sm' | 'md';
}) {
  const { current, completed } = getPipelineStep(status, hasChapters, totalQuestions);
  const isCompleted = status === 'COMPLETED';

  const dotSize = size === 'md' ? 22 : 16;
  const fontSize = size === 'md' ? 10 : 8;
  const lineW = size === 'md' ? 36 : 28;

  return (
    <div className={`flex items-center ${archived ? 'opacity-50' : ''}`}>
      {STEPS.map((step, idx) => {
        const isDone = idx < completed;
        const isCurrent = idx === current;
        const isFuture = idx > current;
        const dotColor = isDone ? 'var(--cyan)' : isCurrent ? 'var(--fox)' : 'var(--ink-200)';
        const bgColor = isDone ? '#d4edda' : isCurrent ? 'var(--fox-glow)' : 'var(--paper-dark)';

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div style={{
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: isDone ? 'var(--cyan)' : isCurrent ? 'var(--fox)' : 'var(--ink-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fontSize,
                fontWeight: 600,
                color: '#fff',
                transition: 'all 0.3s',
              }}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: size === 'md' ? 9 : 7,
                color: isCurrent ? 'var(--fox-dark)' : 'var(--ink-300)',
                marginTop: 2,
                whiteSpace: 'nowrap',
              }}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                width: lineW,
                height: 2,
                background: idx < completed ? 'var(--cyan)' : 'var(--ink-100)',
                margin: '0 2px',
                marginBottom: 12,
                transition: 'all 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
