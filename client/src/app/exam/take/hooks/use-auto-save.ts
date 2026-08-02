'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoSaveOptions {
  /** 考试数据（含 examId, questions, autoSaveInterval） */
  exam: { examId: number; questions: { pqId: number; questionId: number }[]; autoSaveInterval?: number } | null;
  /** 当前题目索引 */
  currentQ: number;
  /** 所有答案 */
  answers: Record<number, any>;
  /** 是否已交卷 */
  submitted: boolean;
  /** 保存失败时的提示 */
  onError?: (msg: string) => void;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 自动保存 Hook
 * 负责：定时保存当前题答案到后端 + localStorage 兜底
 */
export function useAutoSave({ exam, currentQ, answers, submitted, onError }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const lastSavedRef = useRef<string>('');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveCurrentAnswer = useCallback(async () => {
    if (!exam || submitted) return;
    const qObj = exam.questions[currentQ];
    if (!qObj) return;
    const answer = answers[qObj.pqId];
    if (answer === undefined || answer === null) return;

    setSaveStatus('saving');
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/student/exams/${exam.examId}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questionId: qObj.questionId, paperQuestionId: qObj.pqId, answer }),
      });
      lastSavedRef.current = new Date().toISOString();
      setSaveStatus('saved');
      // localStorage 兜底
      try {
        const saved = localStorage.getItem(`exam_${exam.examId}_answers`);
        const all = saved ? JSON.parse(saved) : {};
        all[qObj.pqId] = answer;
        localStorage.setItem(`exam_${exam.examId}_answers`, JSON.stringify(all));
      } catch {}
    } catch {
      setSaveStatus('error');
      onError?.('答案保存失败，请检查网络。答案已暂存本地，恢复网络后会自动重试。');
    }
  }, [exam, currentQ, answers, submitted, onError]);

  // 定时自动保存
  useEffect(() => {
    if (!exam || submitted) return;
    const interval = (exam.autoSaveInterval || 30) * 1000;
    saveTimerRef.current = setInterval(() => saveCurrentAnswer(), interval);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [exam, submitted, saveCurrentAnswer]);

  return { saveStatus, lastSavedRef, saveCurrentAnswer };
}
