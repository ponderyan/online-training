'use client';

import { EXAM_STATUS_LABELS } from '@/lib/exam-constants';

interface Props {
  exam: any;
  students: any[];
  isOffline: boolean;
}

export default function ExamStatusCards({ exam, students, isOffline }: Props) {
  const submittedCount = students.filter(s => s.status === 'SUBMITTED').length;
  const activeCount = students.filter(s => s.status === 'ACTIVE').length;
  const pausedCount = students.filter(s => s.status === 'PAUSED').length;
  const pendingCount = students.length - submittedCount - activeCount - pausedCount;

  const cards = isOffline ? [
    { label: '考试状态', value: EXAM_STATUS_LABELS[exam.status] || exam.status, color: 'var(--ink-300)' },
    { label: '已录入', value: students.filter(s => s.totalScore !== null && !s.absent).length, color: 'var(--sage)' },
    { label: '待录入', value: students.filter(s => s.totalScore === null && !s.absent).length, color: 'var(--fox)' },
    { label: '缺考', value: students.filter(s => s.absent).length, color: 'var(--verm)' },
    { label: '通过', value: students.filter(s => s.isPassed).length, color: 'var(--green)' },
  ] : [
    { label: '考试状态', value: EXAM_STATUS_LABELS[exam.status] || exam.status, color: 'var(--ink-300)' },
    { label: '已提交', value: submittedCount, color: 'var(--info)' },
    { label: '考试中', value: activeCount, color: 'var(--fox)' },
    { label: '已断线', value: pausedCount, color: 'var(--error)' },
    { label: '待参加', value: pendingCount, color: 'var(--ink-500)' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {cards.map((s, i) => (
        <div key={i} className="rounded-xl p-4 text-center transition-all" style={{ background: 'var(--paper-bright)', border: '1px solid var(--ink-100)' }}>
          <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}
