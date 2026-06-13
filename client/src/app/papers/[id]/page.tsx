'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFF_LABELS: Record<string, string> = {
  EASY: '易', MEDIUM: '较易', HARD: '较难', VERY_HARD: '难',
};
const DIFF_COLORS: Record<string, string> = {
  EASY: 'var(--cyan)', MEDIUM: 'var(--gold)', HARD: 'var(--ink-500)', VERY_HARD: 'var(--verm)',
};
const DIFF_BG: Record<string, string> = {
  EASY: 'var(--cyan-glow)', MEDIUM: 'var(--gold-glow)', HARD: 'transparent', VERY_HARD: 'var(--verm-glow)',
};

export default function PaperDetailPage() {
  const router = useRouter();
  const params = useParams();
  const paperId = Number(params.id);

  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.papers.get(paperId);
      setPaper(data);
    } catch (e: any) {
      setError('加载失败：' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [paperId]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'OFFICIAL': return '正式考卷';
      case 'FINALIZED': return '已定稿';
      default: return '草稿';
    }
  };

  const handleFinalize = async () => {
    if (!paper) return;
    await api.papers.finalize(paper.id);
    load();
  };
  const handlePromote = async () => {
    if (!paper) return;
    await api.papers.promote(paper.id);
    load();
  };
  const handleDelete = async () => {
    if (!paper) return;
    if (!confirm('确认删除此试卷？')) return;
    await api.papers.delete(paper.id);
    router.push('/papers');
  };
  const handleDownload = (format: 'word' | 'pdf') => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-${format}`;
    a.click();
  };

  const canFinalize = paper?.status === 'DRAFT';
  const canPromote = paper?.status === 'FINALIZED';

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div>
      </AppLayout>
    );
  }

  if (error || !paper) {
    return (
      <AppLayout>
        <div className="text-center py-16" style={{ color: 'var(--verm)' }}>{error || '试卷不存在'}</div>
      </AppLayout>
    );
  }

  // Group questions by type section
  const groups: Record<string, any[]> = {};
  paper.questions?.forEach((pq: any) => {
    const section = pq.typeSection || 'Other';
    if (!groups[section]) groups[section] = [];
    groups[section].push(pq);
  });

  return (
    <AppLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/papers')}
          className="btn btn-ghost btn-sm">
          ← 返回试卷列表
        </button>
        <div className="flex gap-2 flex-wrap justify-end">
          {paper.status !== 'DRAFT' && (
            <>
              <button onClick={() => handleDownload('word')} className="btn btn-outline btn-sm">下载 Word</button>
              <button onClick={() => handleDownload('pdf')} className="btn btn-outline btn-sm">下载 PDF</button>
            </>
          )}
          {paper.status === 'DRAFT' && (
            <button onClick={() => router.push(`/generate?copyFrom=${paper.id}`)} className="btn btn-outline btn-sm">修改配置</button>
          )}
          {canFinalize && (
            <button onClick={handleFinalize} className="btn btn-sm" style={{ background: 'var(--cyan)', color: '#fff' }}>定稿</button>
          )}
          {canPromote && (
            <button onClick={handlePromote} className="btn btn-verm btn-sm">转为正式</button>
          )}
          <button onClick={handleDelete} className="btn btn-ghost btn-sm" style={{ color: 'var(--ink-300)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
        </div>
      </div>

      {/* Paper header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="page-title">{paper.name}</h1>
            <div className="flex items-center flex-wrap gap-3 mt-2 text-sm" style={{ color: 'var(--ink-400)' }}>
              <span className={`tag ${
                paper.status === 'OFFICIAL' ? 'tag-verm' :
                paper.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
              }`}>{statusLabel(paper.status)}</span>
              <span>{paper.paperNumber}</span>
              <span>{paper.totalScore} 分</span>
              <span>{paper.questions?.length || 0} 题</span>
              <span>{paper.durationMinutes || '—'} 分钟</span>
              <span>{paper.isOpenBook ? '开卷' : '闭卷'}</span>
            </div>
          </div>
        </div>
        {paper.subject && (
          <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
            科目：{paper.subject.name} ({paper.subject.code})
            {paper.creator && <span> · 命题人：{paper.creator.displayName}</span>}
            <span> · 创建于 {new Date(paper.createdAt).toLocaleDateString('zh-CN')}</span>
            {paper.finalizedAt && <span> · 定稿于 {new Date(paper.finalizedAt).toLocaleDateString('zh-CN')}</span>}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setShowAnswer(!showAnswer)}
          className={`btn btn-sm ${showAnswer ? 'btn-verm' : 'btn-outline'}`}>
          {showAnswer ? '隐藏答案' : '显示答案'}
        </button>
        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>答案仅供命题人查阅</span>
      </div>

      {/* Questions content */}
      <div className="card p-6">
        {Object.entries(groups).length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--ink-300)' }}>此试卷暂无试题</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([section, items]) => (
              <div key={section}>
                <div className="flex items-center gap-4 mb-4 pb-3 border-b-2" style={{ borderColor: 'var(--ink-900)' }}>
                  <span className="text-sm font-bold px-3 py-0.5 rounded" style={{ background: 'var(--ink-900)', color: 'var(--paper-bright)' }}>
                    {TYPE_NAMES[section] || section}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {items.length} 题 · 每题{items[0]?.score || '—'}分 · 共{items.reduce((s, pq) => s + pq.score, 0)}分
                  </span>
                </div>

                <div className="space-y-5">
                  {items.map((pq: any, i: number) => {
                    const q = pq.question;
                    if (!q) return null;

                    return (
                      <div key={pq.id} className="pb-5 border-b border-dashed last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-sm font-bold min-w-[24px]" style={{ color: 'var(--ink-800)' }}>{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm leading-relaxed mb-2" style={{ color: 'var(--ink-800)' }}>{q.content}</div>
                            {q.difficulty && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: DIFF_BG[q.difficulty] || 'transparent', color: DIFF_COLORS[q.difficulty] || 'var(--ink-500)' }}>
                                {DIFF_LABELS[q.difficulty] || q.difficulty}
                              </span>
                            )}
                          </div>
                          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-300)' }}>({pq.score}分)</span>
                        </div>

                        {/* Options */}
                        {q.options?.length > 0 && (
                          <div className="ml-9 space-y-2 mb-3">
                            {q.options.map((o: any) => (
                              <div key={o.id} className="flex items-center gap-2 text-sm">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                                  showAnswer && o.isCorrect
                                    ? 'text-white'
                                    : ''
                                }`}
                                  style={{
                                    background: showAnswer && o.isCorrect ? 'var(--cyan)' : 'var(--paper-dark)',
                                    color: showAnswer && o.isCorrect ? '#fff' : 'var(--ink-500)',
                                  }}>
                                  {o.label}
                                </span>
                                <span style={{
                                  color: showAnswer && o.isCorrect ? 'var(--cyan)' : 'var(--ink-500)',
                                  fontWeight: showAnswer && o.isCorrect ? 500 : 400,
                                }}>
                                  {o.content}
                                </span>
                                {showAnswer && o.isCorrect && (
                                  <span className="text-xs font-medium" style={{ color: 'var(--cyan)' }}>✓ 正确答案</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Blanks */}
                        {q.blanks?.length > 0 && (
                          <div className="ml-9 space-y-1 mb-3">
                            {q.blanks.map((b: any) => (
                              <div key={b.id} className="text-sm">
                                <span style={{ color: 'var(--ink-300)' }}>填空 {b.blankIndex + 1}：</span>
                                {showAnswer ? (
                                  <span className="font-medium border-b border-dashed" style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}>{b.answer}</span>
                                ) : (
                                  <span className="border-b border-dashed px-8" style={{ borderColor: 'var(--ink-100)' }}>______</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sub-questions */}
                        {q.subQuestions?.length > 0 && (
                          <div className="ml-9 space-y-2 mt-3 p-4 rounded" style={{ background: 'var(--paper)' }}>
                            {q.subQuestions.map((sq: any, si: number) => (
                              <div key={sq.id} className="text-sm">
                                <span style={{ color: 'var(--ink-300)' }}>({si + 1})</span> {sq.content}
                                {showAnswer && sq.answer && (
                                  <div className="text-sm mt-1" style={{ color: 'var(--cyan)' }}>答：{sq.answer}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Answer key panel */}
      {showAnswer && (
        <div className="card p-5 mt-4" style={{ borderColor: 'var(--verm)', borderWidth: '2px' }}>
          <h3 className="section-title mb-3">
            <span style={{ color: 'var(--verm)' }}>☰</span> 参考答案
            <span className="tag tag-verm">仅供命题人查阅</span>
          </h3>
          {paper.questions?.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groups).map(([section, items]) => (
                <div key={section}>
                  <h4 className="text-sm font-bold mb-2 pb-1 border-b" style={{ color: 'var(--ink-500)', borderColor: 'var(--ink-100)' }}>
                    {TYPE_NAMES[section] || section}
                  </h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {items.map((pq: any, i: number) => {
                      const q = pq.question;
                      let answer = '—';
                      if (q?.type === 'SINGLE_CHOICE') {
                        const correct = q.options?.find((o: any) => o.isCorrect);
                        answer = correct?.label || '—';
                      } else if (q?.type === 'MULTIPLE_CHOICE') {
                        answer = q.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join('、') || '—';
                      } else if (q?.type === 'TRUE_FALSE') {
                        const correct = q.options?.[0];
                        answer = correct?.isCorrect ? '正确' : '错误';
                      } else if (q?.type === 'FILL_BLANK') {
                        answer = q.blanks?.map((b: any) => b.answer).join('；') || '—';
                      } else {
                        answer = '见试题详情';
                      }
                      return (
                        <div key={pq.id} className="flex gap-2 text-xs py-1 border-b border-dashed last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
                          <span style={{ color: 'var(--ink-300)' }}>{i + 1}.</span>
                          <span className="font-medium" style={{ color: 'var(--cyan)' }}>{answer}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>暂无试题</p>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t" style={{ borderColor: 'var(--ink-100)' }}>
        <button onClick={() => router.push('/papers')} className="btn btn-ghost btn-sm">← 返回试卷列表</button>
        <div className="flex gap-3">
          {canFinalize && (
            <button onClick={handleFinalize} className="btn btn-sm" style={{ background: 'var(--cyan)', color: '#fff' }}>定稿并冻结试题</button>
          )}
          {canPromote && (
            <button onClick={handlePromote} className="btn btn-verm btn-sm">发布为正式考卷</button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
