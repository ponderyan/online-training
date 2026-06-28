'use client';

import { useSearchParams } from 'next/navigation';
import PracticePlayer from '@/components/practice-player';
import { api } from '@/lib/api';

export default function ChapterPracticePage() {
  const sp = useSearchParams();
  const subjectId = sp.get('subjectId') || undefined;
  const chapterId = sp.get('chapterId') || undefined;
  const chapterName = sp.get('chapterName') || '';

  const loadQuestions = async () => {
    const params: Record<string, string> = {};
    if (subjectId) params.subjectId = subjectId;
    if (chapterId) params.chapterId = chapterId;
    return api.practice.questions(params);
  };

  return <PracticePlayer title={`章节练习${chapterName ? ' — ' + chapterName : ''}`} loadQuestions={loadQuestions} />;
}
