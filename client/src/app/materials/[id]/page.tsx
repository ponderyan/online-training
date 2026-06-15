'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFF_LABELS: Record<string, string> = {
  EASY: '易', MEDIUM_EASY: '较易', MEDIUM_HARD: '较难', HARD: '难',
};
const DIFF_COLORS: Record<string, string> = {
  EASY: 'var(--cyan)', MEDIUM_EASY: 'var(--gold)', MEDIUM_HARD: 'var(--fox)', HARD: 'var(--verm)',
};
const GROUP_NAMES: Record<string, string> = {
  PRACTICE_GROUP: '练习组', EXAM_GROUP: '考试组', COMMON_GROUP: '通用组',
};

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const materialId = Number(params.id);

  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.materials.get(materialId);
      setMaterial(data);
      if (data.chapters?.length > 0 && activeChapter === null) {
        setActiveChapter(data.chapters[0].id);
      }
    } catch { router.push('/materials'); }
    setLoading(false);
  }, [materialId]);

  useEffect(() => { load(); }, [load]);

  const filteredQuestions = material?.questions?.filter(
    (q: any) => q.chapterId === activeChapter
  ) || [];
  const current = filteredQuestions[currentIndex];

  const reviewCounts = {
    all: material?.questions?.length || 0,
    pending: material?.questions?.filter((q: any) => q.reviewStatus === 'PENDING').length || 0,
    approved: material?.questions?.filter((q: any) => q.reviewStatus === 'APPROVED').length || 0,
    rejected: material?.questions?.filter((q: any) => q.reviewStatus === 'REJECTED').length || 0,
  };

  const handleReview = async (status: 'APPROVED' | 'REJECTED' | 'EDITED', extra?: any) => {
    if (!current) return;
    try {
      const data: any = { reviewStatus: status, ...extra };
      if (editMode) {
        data.content = editData.content;
        data.options = editData.options;
        data.answer = editData.answer;
        data.explanation = editData.explanation;
        data.difficulty = editData.difficulty;
        data.suggestedGroup = editData.suggestedGroup;
      }
      await api.materials.reviewQuestion(current.id, data);
      setEditMode(false);
      load();
      if (currentIndex < filteredQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (e: any) {
      alert('操作失败：' + e.message);
    }
  };

  const handleBatchImport = async () => {
    if (!confirm('确认一键导入全部待审核试题到题库？')) return;
    setImporting(true);
    try {
      await api.materials.batchReview(materialId, { action: 'approve' });
      load();
    } catch (e: any) {
      alert('导入失败：' + e.message);
    }
    setImporting(false);
  };

  const enterEdit = () => {
    if (!current) return;
    setEditMode(true);
    setEditData({
      content: current.content,
      options: current.options || [],
      answer: current.answer || '',
      explanation: current.explanation || '',
      difficulty: current.difficulty,
      suggestedGroup: current.suggestedGroup || 'EXAM_GROUP',
    });
  };

  if (loading) return (
    <AppLayout>
      <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
    </AppLayout>
  );
  if (!material) return null;

  const totalQuestions = material.questions?.length || 0;
  const chapterQuestionCount = (chId: number) =>
    material.questions?.filter((q: any) => q.chapterId === chId && q.reviewStatus !== 'REJECTED').length || 0;
  const chapterReviewedCount = (chId: number) =>
    material.questions?.filter((q: any) => q.chapterId === chId && q.reviewStatus !== 'PENDING').length || 0;
  const chapterPendingCount = (chId: number) =>
    material.questions?.filter((q: any) => q.chapterId === chId && q.reviewStatus === 'PENDING').length || 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push('/materials')}
              className="text-xs bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--fox)' }}>← 返回教材列表</button>
          </div>
          <h1 className="page-title">📖 {material.name}</h1>
          <p className="page-subtitle">
            {material.subject?.code} · {material.chapters?.length || 0} 章 · 共 {totalQuestions} 题
            &nbsp;|&nbsp;
            待审核 <span style={{ color: 'var(--fox)' }}>{reviewCounts.pending}</span>
            &nbsp;·&nbsp; 已通过 {reviewCounts.approved}
            &nbsp;·&nbsp; 已拒绝 {reviewCounts.rejected}
          </p>
        </div>
        <div className="flex gap-2">
          {reviewCounts.pending > 0 && (
            <button onClick={handleBatchImport} disabled={importing}
              className="btn btn-fox btn-sm">
              {importing ? '导入中…' : `一键导入全部 (${reviewCounts.pending})`}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Chapter sidebar */}
        <div className="w-[200px] flex-shrink-0 space-y-1">
          <div className="text-xs font-semibold mb-2 px-2" style={{ color: 'var(--ink-400)' }}>章节列表</div>
          {material.chapters?.map((ch: any) => {
            const total = chapterQuestionCount(ch.id);
            const pending = chapterPendingCount(ch.id);
            const reviewed = chapterReviewedCount(ch.id);
            if (total === 0) return null;
            return (
              <div key={ch.id} onClick={() => { setActiveChapter(ch.id); setCurrentIndex(0); setEditMode(false); }}
                className="px-3 py-2 rounded-lg cursor-pointer text-xs transition-all"
                style={{
                  background: activeChapter === ch.id ? 'var(--fox-glow)' : 'transparent',
                  color: activeChapter === ch.id ? 'var(--fox-dark)' : 'var(--ink-500)',
                  borderLeft: activeChapter === ch.id ? '3px solid var(--fox)' : '3px solid transparent',
                }}>
                <div className="font-medium mb-0.5 truncate">{ch.title}</div>
                <div style={{ color: 'var(--ink-300)' }}>
                  {total} 题
                  {pending > 0 && <span style={{ color: 'var(--fox)' }}> · {pending} 待审</span>}
                  {reviewed > 0 && <span style={{ color: 'var(--cyan)' }}> · {reviewed} 已审</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main review area */}
        <div className="flex-1 min-w-0">
          {!current ? (
            <div className="card p-10 text-center" style={{ color: 'var(--ink-300)' }}>
              {filteredQuestions.length === 0
                ? '📭 这一章还没有试题'
                : '🎉 这一章全部审核完毕！'}
            </div>
          ) : (
            <div className="animate-fadeSlide">
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--paper-dark)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%`,
                      background: 'var(--fox)',
                    }} />
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-400)' }}>
                  第 {currentIndex + 1}/{filteredQuestions.length} 题
                </span>
              </div>

              {/* Current question card */}
              <div className="card p-6 mb-4">
                {/* Meta row */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className={`tag ${
                    current.reviewStatus === 'APPROVED' ? 'tag-cyan' :
                    current.reviewStatus === 'REJECTED' ? 'tag-verm' :
                    current.reviewStatus === 'EDITED' ? 'tag-fox' : 'tag-ink'
                  }`}>
                    {current.reviewStatus === 'PENDING' ? '⏳ 待审核' :
                     current.reviewStatus === 'APPROVED' ? '✅ 已通过' :
                     current.reviewStatus === 'REJECTED' ? '❌ 已拒绝' : '✏️ 已修改'}
                  </span>
                  <span className="tag tag-ink">{TYPE_NAMES[current.type]}</span>
                  <span className="tag" style={{
                    background: DIFF_COLORS[current.difficulty] + '18',
                    color: DIFF_COLORS[current.difficulty],
                    border: `1px solid ${DIFF_COLORS[current.difficulty]}30`,
                  }}>{DIFF_LABELS[current.difficulty]}</span>
                  {current.knowledgePoint && (
                    <span className="tag tag-gold">{current.knowledgePoint}</span>
                  )}
                  {current.suggestedGroup && (
                    <span className="tag tag-fox">{GROUP_NAMES[current.suggestedGroup] || current.suggestedGroup}</span>
                  )}
                  {current.sourceChunk && (
                    <span className="text-xs" style={{ color: 'var(--ink-300)' }}>📄 {current.sourceChunk}</span>
                  )}
                </div>

                {/* Question content - view mode */}
                {!editMode ? (
                  <>
                    <div className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ink-700)' }}>
                      {current.content}
                    </div>

                    {/* Options for choice questions */}
                    {current.options && Array.isArray(current.options) && (
                      <div className="space-y-2 mb-4">
                        {current.options.map((opt: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: opt.isCorrect ? 'var(--cyan-glow)' : 'var(--paper)',
                              color: opt.isCorrect ? 'var(--cyan)' : 'var(--ink-600)',
                            }}>
                            <span className="font-mono font-bold w-5 flex-shrink-0">{opt.label}.</span>
                            <span>{opt.content}</span>
                            {opt.isCorrect && <span className="ml-auto text-xs">✓ 正确答案</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Answer & Explanation */}
                    {current.answer && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cyan)' }}>参考答案</div>
                        <div className="text-sm p-3 rounded-lg" style={{ background: 'var(--cyan-glow)', color: 'var(--ink-700)' }}>
                          {current.answer}
                        </div>
                      </div>
                    )}
                    {current.explanation && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--fox)' }}>解析</div>
                        <div className="text-sm p-3 rounded-lg" style={{ background: 'var(--fox-pale)', color: 'var(--ink-700)' }}>
                          {current.explanation}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Edit mode */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>题干</label>
                      <textarea value={editData.content} onChange={e => setEditData({ ...editData, content: e.target.value })}
                        className="input textarea" rows={3} />
                    </div>
                    {current.options && Array.isArray(current.options) && (
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>选项</label>
                        <div className="space-y-2">
                          {editData.options.map((opt: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="font-mono text-sm w-5">{opt.label}.</span>
                              <input value={opt.content} onChange={e => {
                                const opts = [...editData.options];
                                opts[i] = { ...opts[i], content: e.target.value };
                                setEditData({ ...editData, options: opts });
                              }} className="input flex-1" />
                              <label className="flex items-center gap-1 text-xs cursor-pointer flex-shrink-0">
                                <input type="checkbox" checked={opt.isCorrect}
                                  onChange={e => {
                                    const opts = [...editData.options];
                                    opts[i] = { ...opts[i], isCorrect: e.target.checked };
                                    setEditData({ ...editData, options: opts });
                                  }} />
                                正确
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>参考答案</label>
                        <textarea value={editData.answer} onChange={e => setEditData({ ...editData, answer: e.target.value })}
                          className="input textarea" rows={2} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>解析</label>
                        <textarea value={editData.explanation} onChange={e => setEditData({ ...editData, explanation: e.target.value })}
                          className="input textarea" rows={2} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>难度</label>
                        <select value={editData.difficulty} onChange={e => setEditData({ ...editData, difficulty: e.target.value })}
                          className="input select">
                          {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>分组</label>
                        <select value={editData.suggestedGroup} onChange={e => setEditData({ ...editData, suggestedGroup: e.target.value })}
                          className="input select">
                          <option value="PRACTICE_GROUP">练习组</option>
                          <option value="EXAM_GROUP">考试组</option>
                          <option value="COMMON_GROUP">通用组</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {current.reviewStatus === 'PENDING' && (
                <div className="flex gap-3">
                  {!editMode ? (
                    <>
                      <button onClick={() => handleReview('REJECTED')}
                        className="btn btn-outline flex-1 py-2.5"
                        style={{ borderColor: 'var(--verm)', color: 'var(--verm)' }}>
                        拒绝 ✕
                      </button>
                      <button onClick={enterEdit}
                        className="btn btn-outline flex-1 py-2.5">
                        修改后入库 ✏️
                      </button>
                      <button onClick={() => handleReview('APPROVED')}
                        className="btn btn-fox flex-1 py-2.5">
                        确认入库 ✓
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditMode(false)}
                        className="btn btn-outline flex-1 py-2.5">取消修改</button>
                      <button onClick={() => handleReview('EDITED')}
                        className="btn btn-fox flex-1 py-2.5">
                        保存修改并入库 💾
                      </button>
                    </>
                  )}
                </div>
              )}

              {current.reviewStatus !== 'PENDING' && (
                <div className="text-center py-4">
                  <button onClick={() => {
                    if (currentIndex < filteredQuestions.length - 1) {
                      setCurrentIndex(currentIndex + 1);
                    }
                  }} className="btn btn-fox">
                    {currentIndex < filteredQuestions.length - 1 ? '下一题 →' : '回到章节开头'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right stats sidebar */}
        <div className="w-[180px] flex-shrink-0">
          <div className="card p-4 text-xs space-y-2" style={{ color: 'var(--ink-400)' }}>
            <div className="font-semibold mb-1" style={{ color: 'var(--ink-600)' }}>📊 汇总</div>
            <div className="flex justify-between"><span>全部试题</span><span>{reviewCounts.all}</span></div>
            <div className="flex justify-between" style={{ color: 'var(--fox)' }}>
              <span>待审核</span><span>{reviewCounts.pending}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--cyan)' }}>
              <span>已通过</span><span>{reviewCounts.approved}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--verm)' }}>
              <span>已拒绝</span><span>{reviewCounts.rejected}</span>
            </div>
            <hr className="divider" />
            <div className="font-semibold" style={{ color: 'var(--ink-600)' }}>💡 提示</div>
            <p>每道题依次审完即可。</p>
            <p>确认后的题将自动入库。</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
