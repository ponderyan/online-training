'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题', ESSAY: '论文题',
};
const DIFF_LABELS: Record<string, string> = {
  EASY: '易', MEDIUM_EASY: '较易', MEDIUM_HARD: '较难', HARD: '难',
};
const DIFF_COLORS: Record<string, string> = {
  EASY: 'var(--cyan)', MEDIUM_EASY: 'var(--gold)', MEDIUM_HARD: 'var(--ink-500)', HARD: 'var(--verm)',
};
const DIFF_BG: Record<string, string> = {
  EASY: 'var(--cyan-glow)', MEDIUM_EASY: 'var(--gold-glow)', MEDIUM_HARD: 'transparent', HARD: 'var(--verm-glow)',
};

export default function PaperDetailPage() {
  const router = useRouter();
  const params = useParams();
  const paperId = Number(params.id);
  const toast = useToast();

  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [deletePaperTarget, setDeletePaperTarget] = useState<boolean | null>(null);
  const [showPickModal, setShowPickModal] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [pickingSection, setPickingSection] = useState('');
  const [pickingScore, setPickingScore] = useState(0);
  const [removeQuestionTarget, setRemoveQuestionTarget] = useState<number | null>(null);

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
      case 'PENDING_REVIEW': return '待审核';
      default: return '草稿';
    }
  };

  // 按题型分组统计
  const countByType = (questions: any[]) => {
    const counts: Record<string, number> = {};
    let totalScore = 0;
    for (const pq of questions || []) {
      const section = pq.typeSection || 'Other';
      counts[section] = (counts[section] || 0) + 1;
      totalScore += pq.score || 0;
    }
    return { counts, totalScore };
  };

  const { counts: actualCounts, totalScore: actualTotal } = countByType(paper?.questions);

  const handleFinalize = async () => {
    if (!paper) return;
    const qLen = paper.questions?.length || 0;
    // 验证：至少1题
    if (qLen === 0) {
      toast.warning('试卷没有试题，请至少添加一道题后再定稿。');
      return;
    }
    // 验证：总分必须匹配
    if (actualTotal !== paper.totalScore) {
      toast.warning(`总分不匹配：当前试题总分 ${actualTotal}分 ≠ 试卷设定总分 ${paper.totalScore}分，请调整试题后再定稿。`);
      return;
    }
    await api.papers.finalize(paper.id);
    load();
  };

  const handlePromote = async () => {
    if (!paper) return;
    await api.papers.promote(paper.id);
    load();
  };

  const handleSubmitReview = async () => {
    if (!paper) return;
    try {
      await api.papers.submitReview(paper.id);
      toast.success('已提交审题');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleApproveReview = async () => {
    if (!paper) return;
    try {
      await api.papers.approveReview(paper.id);
      toast.success('审题通过，试卷已定稿');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRejectReview = async () => {
    if (!paper) return;
    const reason = prompt('请输入驳回原因（可选）：');
    try {
      await api.papers.rejectReview(paper.id, reason || undefined);
      toast.success('已驳回，试卷回到草稿状态');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePaperDeleteWithReason = async (reason: string) => {
    if (!paper) return;
    await api.papers.delete(paper.id);
    setDeletePaperTarget(false);
    router.push('/papers');
  };

  const getToken = () => localStorage.getItem('token') || '';
  const handleDownload = (format: 'word' | 'pdf') => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-${format}?token=${getToken()}`;
    a.click();
  };

  const handleRemoveQuestion = async (pqId: number) => {
    setRemoveQuestionTarget(pqId);
  };

  const confirmRemoveQuestion = async (reason: string) => {
    if (!removeQuestionTarget) return;
    await fetch(`/api/papers/${paperId}/questions/${removeQuestionTarget}`, { method: 'DELETE' });
    setRemoveQuestionTarget(null);
    load();
  };

  const [replaceTarget, setReplaceTarget] = useState<{ pqId: number; section: string } | null>(null);
  const [addToPractice, setAddToPractice] = useState(true);

  const handleReplaceQuestion = async (pqId: number, section: string, score: number) => {
    // 打开选题弹窗，从同题型题库中选择替换
    const data = await api.questions.list({ type: section, status: 'PUBLISHED', subjectId: String(paper.subjectId), pageSize: '200' });
    const currentQIds = new Set(paper.questions?.map((pq: any) => pq.questionId) || []);
    const available = (data.items || []).filter((q: any) => !currentQIds.has(q.id));
    if (available.length === 0) {
      toast.warning('没有可替换的试题（该题型下所有试题已在试卷中）');
      return;
    }
    setAvailableQuestions(available);
    setPickingSection(section);
    setPickingScore(score);
    setReplaceTarget({ pqId, section });
    setShowPickModal(true);
  };

  const openPickModal = async (section: string, score: number) => {
    setPickingSection(section);
    setPickingScore(score);
    const data = await api.questions.list({ type: section, status: 'PUBLISHED', subjectId: String(paper.subjectId), pageSize: '200' });
    const currentQIds = new Set(paper.questions?.map((pq: any) => pq.questionId) || []);
    setAvailableQuestions((data.items || []).filter((q: any) => !currentQIds.has(q.id)));
    setShowPickModal(true);
  };

  const handleAddQuestion = async (questionId: number) => {
    if (replaceTarget) {
      // 替换模式
      await fetch(`/api/papers/${paperId}/questions/${replaceTarget.pqId}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newQuestionId: questionId }),
      });
      setReplaceTarget(null);
    } else {
      // 加题模式
      await fetch(`/api/papers/${paperId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, score: pickingScore, typeSection: pickingSection }),
      });
      // 如果勾选了加入练习
      if (addToPractice) {
        await api.questions.update(questionId, { practiceVisible: true }).catch(() => {});
      }
    }
    setShowPickModal(false);
    load();
  };

  const canEdit = paper?.status === 'DRAFT';
  const canFinalize = paper?.status === 'DRAFT';
  const canReview = paper?.status === 'PENDING_REVIEW';
  const canPromote = paper?.status === 'FINALIZED';

  if (loading) {
    return (
      <AppLayout>
        <div className="text-[var(--ink-300)] text-center py-16">加载中…</div>
      </AppLayout>
    );
  }

  if (error || !paper) {
    return (
      <AppLayout>
        <div className="text-[var(--verm)] text-center py-16">{error || '试卷不存在'}</div>
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
        <button onClick={() => router.push('/papers')} className="btn btn-ghost btn-sm">← 返回试卷列表</button>
        <div className="flex gap-2 flex-wrap justify-end">
          {!canEdit && (
            <>
              <button onClick={() => handleDownload('word')} className="btn btn-outline btn-sm">下载试卷</button>
              <button onClick={() => { const a = document.createElement('a'); a.href = `/api/papers/${paperId}/export-answer-sheet?token=${getToken()}`; a.click(); }}
                className="btn btn-fox btn-sm">答题卡</button>
              <button onClick={() => handleDownload('pdf')} className="btn btn-outline btn-sm">PDF</button>
            </>
          )}
          {canEdit && (
            <>
              <button onClick={() => router.push(`/generate?copyFrom=${paper.id}`)} className="btn btn-outline btn-sm">修改配置</button>
              <button onClick={handleSubmitReview} className="btn btn-sm bg-[var(--gold)] text-[#fff]" >提交审题</button>
              <button onClick={handleFinalize} className="btn btn-sm bg-[var(--cyan)] text-[#fff]" >直接定稿</button>
            </>
          )}
          {canReview && (
            <>
              <button onClick={handleApproveReview} className="btn btn-sm bg-[var(--cyan)] text-[#fff]" >✓ 审题通过</button>
              <button onClick={handleRejectReview} className="btn btn-outline btn-sm text-[var(--verm)] border-[var(--verm)]" >✗ 驳回</button>
            </>
          )}
          {canPromote && (
            <button onClick={handlePromote} className="btn btn-verm btn-sm">转为正式</button>
          )}
          <button onClick={() => setDeletePaperTarget(true)} className="btn btn-ghost btn-sm text-[var(--ink-300)]" 
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
        </div>
      </div>

      {/* Paper header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="page-title">{paper.name}</h1>
            <div className="text-[var(--ink-400)] flex items-center flex-wrap gap-3 mt-2 text-sm">
              <span className={`tag ${paper.status === 'OFFICIAL' ? 'tag-verm' : paper.status === 'FINALIZED' ? 'tag-cyan' : paper.status === 'PENDING_REVIEW' ? 'tag-gold' : 'tag-ink'}`}>
                {statusLabel(paper.status)}
              </span>
              <span>{paper.paperNumber}</span>
              <span>{paper.totalScore} 分</span>
              <span>{paper.questions?.length || 0} 题</span>
              <span>{paper.durationMinutes || '—'} 分钟</span>
              <span>{paper.isOpenBook ? '开卷' : '闭卷'}</span>
            </div>
            {canEdit && (
              <span className="text-[var(--fox)] text-xs mt-1 inline-block">✏️ 草稿状态，可编辑试题</span>
            )}
            {canReview && (
              <span className="text-[var(--gold-dark)] text-xs mt-1 inline-block">⏳ 待审核状态，等待审题人确认</span>
            )}
          </div>
        </div>
      </div>

      {/* 章节覆盖分布 */}
      {paper.chapterDistribution?.length > 0 && (
        <div className="card p-5 mb-5">
          <h3 className="section-title mb-3">📊 章节覆盖分布</h3>
          <div className="flex flex-wrap gap-3">
            {paper.chapterDistribution.map((ch: any) => (
              <div key={ch.chapterId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
                <span className="text-[var(--ink-600)]">{ch.chapterName}</span>
                <span className="text-[var(--fox)] font-bold">{ch.count}题</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 数量/分值校验提示 */}
      {canEdit && (() => {
        const warnings: string[] = [];
        if (actualTotal !== paper.totalScore) {
          warnings.push(`当前试题总分 ${actualTotal}分 ≠ 设定总分 ${paper.totalScore}分`);
        }
        if (warnings.length === 0) return null;
        return (
          <div className="mb-4 p-3 rounded-lg text-sm bg-[var(--verm-glow)] text-[var(--verm)]" >
            ⚠ {warnings.join('；')}。定稿前请调整试题使总分匹配。
          </div>
        );
      })()}

      {/* Answer toggle bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAnswer(!showAnswer)}
            className={`btn btn-sm ${showAnswer ? 'btn-verm' : 'btn-outline'}`}>
            {showAnswer ? '隐藏答案' : '显示答案'}
          </button>
          <span className="text-[var(--ink-300)] text-xs">答案仅供命题人查阅</span>
        </div>
      </div>

      {/* Questions content */}
      <div className="card p-6">
        {Object.entries(groups).length === 0 ? (
          <div className="text-[var(--ink-300)] text-center py-10">此试卷暂无试题</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([section, items]) => (
              <div key={section}>
                <div className="border-[var(--ink-900)] flex items-center justify-between gap-4 mb-4 pb-3 border-b-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold px-3 py-0.5 rounded bg-[var(--ink-900)] text-[var(--paper-bright)]" >
                      {TYPE_NAMES[section] || section}
                    </span>
                    <span className="text-[var(--ink-300)] text-xs">
                      {items.length} 题 · 每题{items[0]?.score || '—'}分 · 共{items.reduce((s, pq) => s + pq.score, 0)}分
                    </span>
                  </div>
                  {canEdit && (
                    <button onClick={() => openPickModal(section, items[0]?.score || 0)}
                      className="btn btn-xs btn-fox">+ 加题</button>
                  )}
                </div>

                <div className="space-y-5">
                  {items.map((pq: any, i: number) => {
                    const q = pq.question;
                    if (!q) return null;

                    return (
                      <div key={pq.id} className="border-[var(--ink-100)] pb-5 border-b border-dashed group last:border-b-0">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-[var(--ink-800)] text-sm font-bold min-w-[24px]">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[var(--ink-800)] text-sm leading-relaxed mb-2">{q.content}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: DIFF_BG[q.difficulty] || 'transparent', color: DIFF_COLORS[q.difficulty] || 'var(--ink-500)' }}>
                                {DIFF_LABELS[q.difficulty] || q.difficulty}
                              </span>
                              {canEdit && (
                                <>
                                  <button onClick={() => handleReplaceQuestion(pq.id, section, pq.score)}
                                    className="text-xs px-2 py-0.5 rounded hover:bg-[var(--fox-glow)] transition-colors bg-transparent border-none cursor-pointer text-[var(--fox-dark)]"
                                    >换一题</button>
                                  <button onClick={() => handleRemoveQuestion(pq.id)}
                                    className="text-xs px-2 py-0.5 rounded hover:bg-[var(--verm-glow)] transition-colors bg-transparent border-none cursor-pointer text-[var(--verm)]"
                                    >删除</button>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-[var(--ink-300)] text-xs whitespace-nowrap">({pq.score}分)</span>
                        </div>

                        {/* Options */}
                        {q.options?.length > 0 && (
                          <div className="ml-9 space-y-2 mb-3">
                            {q.options.map((o: any) => (
                              <div key={o.id} className="flex items-center gap-2 text-sm">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${showAnswer && o.isCorrect ? 'text-white' : ''}`}
                                  style={{ background: showAnswer && o.isCorrect ? 'var(--cyan)' : 'var(--paper-dark)', color: showAnswer && o.isCorrect ? '#fff' : 'var(--ink-500)' }}>
                                  {o.label}
                                </span>
                                <span style={{ color: showAnswer && o.isCorrect ? 'var(--cyan)' : 'var(--ink-500)', fontWeight: showAnswer && o.isCorrect ? 500 : 400 }}>{o.content}</span>
                                {showAnswer && o.isCorrect && <span className="text-[var(--cyan)] text-xs font-medium">✓</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Blanks & sub-questions (same as before) */}
                        {q.blanks?.length > 0 && (
                          <div className="ml-9 space-y-1 mb-3">
                            {q.blanks.map((b: any) => (
                              <div key={b.id} className="text-sm">
                                <span className="text-[var(--ink-300)]">填空 {b.blankIndex + 1}：</span>
                                {showAnswer ? (
                                  <span className="font-medium border-b border-dashed text-[var(--cyan)] border-[var(--cyan)]" >{b.answer}</span>
                                ) : (
                                  <span className="border-[var(--ink-100)] border-b border-dashed px-8">______</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {q.subQuestions?.length > 0 && (
                          <div className="bg-[var(--paper)] ml-9 space-y-2 mt-3 p-4 rounded">
                            {q.subQuestions.map((sq: any, si: number) => (
                              <div key={sq.id} className="text-sm">
                                <span className="text-[var(--ink-300)]">({si + 1})</span> {sq.content}
                                {showAnswer && sq.answer && <div className="text-[var(--cyan)] text-sm mt-1">答：{sq.answer}</div>}
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
        <div className="card p-5 mt-4 border-[var(--verm)]" style={{  borderWidth: '2px' }}>
          <h3 className="section-title mb-3">
            <span className="text-[var(--verm)]">☰</span> 参考答案
            <span className="tag tag-verm">仅供命题人查阅</span>
          </h3>
          {paper.questions?.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groups).map(([section, items]) => (
                <div key={section}>
                  <h4 className="text-sm font-bold mb-2 pb-1 border-b text-[var(--ink-500)] border-[var(--ink-100)]" >
                    {TYPE_NAMES[section] || section}
                  </h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {items.map((pq: any, i: number) => {
                      const q = pq.question;
                      let answer = '—';
                      if (q?.type === 'SINGLE_CHOICE') { const c = q.options?.find((o: any) => o.isCorrect); answer = c?.label || '—'; }
                      else if (q?.type === 'MULTIPLE_CHOICE') { answer = q.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join('、') || '—'; }
                      else if (q?.type === 'TRUE_FALSE') { answer = q.options?.[0]?.isCorrect ? '正确' : '错误'; }
                      else if (q?.type === 'FILL_BLANK') { answer = q.blanks?.map((b: any) => b.answer).join('；') || '—'; }
                      else { answer = '见试题详情'; }
                      return (
                        <div key={pq.id} className="border-[var(--ink-100)] flex gap-2 text-xs py-1 border-b border-dashed last:border-b-0">
                          <span className="text-[var(--ink-300)]">{i + 1}.</span>
                          <span className="text-[var(--cyan)] font-medium">{answer}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-[var(--ink-300)] text-xs">暂无试题</p>}
        </div>
      )}

      {/* Bottom actions */}
      <div className="border-[var(--ink-100)] flex items-center justify-between mt-6 pt-5 border-t">
        <button onClick={() => router.push('/papers')} className="btn btn-ghost btn-sm">← 返回试卷列表</button>
        <div className="flex gap-3">
          {canPromote && (
            <button onClick={handlePromote} className="btn btn-verm btn-sm">发布为正式考卷</button>
          )}
        </div>
      </div>

      {/* 从题库选题弹窗 */}
      {showPickModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowPickModal(false); setReplaceTarget(null); } }}>
          <div className="modal-card max-w-[600px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">{replaceTarget ? '替换试题' : '从题库选题'} — {TYPE_NAMES[pickingSection] || pickingSection}</h3>
              <button onClick={() => { setShowPickModal(false); setReplaceTarget(null); }} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
            </div>
            {!replaceTarget && (
              <label className="text-[var(--ink-400)] flex items-center gap-2 px-4 pt-2 pb-1 text-xs">
                <input type="checkbox" checked={addToPractice} onChange={e => setAddToPractice(e.target.checked)}
                  className="checkbox checkbox-sm accent-[var(--fox)]" />
                选中题目自动加入练习模式（学员在练习中可见）
              </label>
            )}
            <div className="modal-body max-h-[400px] overflow-y-auto">
              {availableQuestions.length === 0 ? (
                <p className="text-[var(--ink-300)] text-sm text-center py-8">暂无可选试题（所有同类试题可能已在试卷中）</p>
              ) : (
                <div className="space-y-2">
                  {availableQuestions.map((q: any) => (
                    <div key={q.id} onClick={() => handleAddQuestion(q.id)}
                      className="p-3 rounded-lg text-sm cursor-pointer transition-colors bg-[var(--paper)]"
                      
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--fox-glow)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--paper)'}>
                      <p className="text-[var(--ink-700)] line-clamp-2">{q.content}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[var(--ink-300)] text-xs">难度：{DIFF_LABELS[q.difficulty] || q.difficulty}</span>
                        <span className="text-xs" style={{ color: (q.usageCount || 0) >= 5 ? 'var(--verm)' : 'var(--ink-300)' }}>已使用 {q.usageCount || 0} 次{(q.usageCount || 0) >= 5 ? ' ⚠' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowPickModal(false); setReplaceTarget(null); }} className="btn btn-ink btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除试卷弹窗 */}
      <ReasonConfirmModal
        open={deletePaperTarget !== null}
        title="🗑 删除试卷"
        required
        presetReasons={['创建错误', '试卷作废', '重复创建']}
        confirmText="确认删除"
        onConfirm={handlePaperDeleteWithReason}
        onCancel={() => setDeletePaperTarget(null)}
      />
      {/* 从试卷移除试题确认 */}
      <ReasonConfirmModal
        open={removeQuestionTarget !== null}
        title="📝 移除试题"
        message="确认从试卷中移除该试题？试卷内容会被修改，但不影响已分配的考试。"
        required
        presetReasons={['试题不适合本试卷', '题型调整', '创建错误']}
        confirmText="确认移除"
        onConfirm={confirmRemoveQuestion}
        onCancel={() => setRemoveQuestionTarget(null)}
      />
    </AppLayout>
  );
}
