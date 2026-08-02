'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  active: boolean;
  exam: { questions: { pqId: number; type: string; options?: { label: string }[] }[] } | null;
  currentQ: number;
  onNavigate: (index: number) => void;
  onAnswer: (pqId: number, value: any) => void;
  onSubmit: () => void;
  onEscape?: () => void;
}

/**
 * 键盘快捷键 Hook
 * ← → 切题 | A~D 选择 | 1/2 判断 | Ctrl+Enter 交卷 | 阻止 F5/ESC
 */
export function useKeyboardShortcuts({ active, exam, currentQ, onNavigate, onAnswer, onSubmit, onEscape }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!active || !exam) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 阻止 F5 / Ctrl+R / Cmd+R 刷新
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 阻止 ESC
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }
      // ← → 切换题目
      if (e.key === 'ArrowLeft') {
        onNavigate(Math.max(0, currentQ - 1));
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        onNavigate(Math.min(exam.questions.length - 1, currentQ + 1));
        e.preventDefault();
      }

      const question = exam.questions[currentQ];
      if (!question) return;

      // 选择题 A/B/C/D
      if (question.type === 'SINGLE_CHOICE') {
        const keyMap: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
        if (keyMap[e.key.toLowerCase()]) {
          onAnswer(question.pqId, keyMap[e.key.toLowerCase()]);
          e.preventDefault();
        }
      }

      // 判断题 1=正确, 2=错误
      if (question.type === 'TRUE_FALSE') {
        if (question.options && question.options.length >= 2) {
          if (e.key === '1') { onAnswer(question.pqId, question.options[0].label); e.preventDefault(); }
          if (e.key === '2') { onAnswer(question.pqId, question.options[1].label); e.preventDefault(); }
        }
      }

      // Ctrl+Enter 交卷
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        onSubmit();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, exam, currentQ, onNavigate, onAnswer, onSubmit, onEscape]);
}
