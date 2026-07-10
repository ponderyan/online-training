'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ChapterStructureTab from './chapter-structure-tab';
import QuestionPlanTab from './question-plan-tab';

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
const TYPE_SHORT: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
  FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例',
};

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const materialId = Number(params.id);

  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'plan' || tab === 'review' || tab === 'structure') return tab;
    return 'structure';
  });

  // ── 新模式状态 ──
  const [reviewMode, setReviewMode] = useState<'detail' | 'list'>('detail');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const navRef = useRef<HTMLDivElement>(null);

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

  // 当前章节的待审/可选题
  const pendingQuestions = filteredQuestions.filter((q: any) => q.reviewStatus === 'PENDING');
  const selectableIds = new Set(pendingQuestions.map((q: any) => q.id));

  const reviewCounts = {
    all: material?.questions?.length || 0,
    pending: material?.questions?.filter((q: any) => q.reviewStatus === 'PENDING').length || 0,
    approved: material?.questions?.filter((q: any) => q.reviewStatus === 'APPROVED').length || 0,
    rejected: material?.questions?.filter((q: any) => q.reviewStatus === 'REJECTED').length || 0,
    edited: material?.questions?.filter((q: any) => q.reviewStatus === 'EDITED').length || 0,
  };

  // ── 导航 ──
  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= filteredQuestions.length) return;
    setCurrentIndex(idx);
    setEditMode(false);
  };
  const goPrev = () => goToQuestion(currentIndex - 1);
  const goNext = () => goToQuestion(currentIndex + 1);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < filteredQuestions.length - 1;

  // 滚动导航条使当前题号可见
  useEffect(() => {
    if (reviewMode !== 'detail' || !navRef.current) return;
    const btns = navRef.current.querySelectorAll('button');
    if (btns[currentIndex]) {
      btns[currentIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex, reviewMode]);

  // ── 审核 + 编辑 ──
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
      if (hasNext) {
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

  // ── 批量操作 ──
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === pendingQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingQuestions.map((q: any) => q.id)));
    }
  };
  const selectedPendingCount = [...selectedIds].filter(id => selectableIds.has(id)).length;

  const handleBatchReview = async (action: 'approve' | 'reject') => {
    const ids = [...selectedIds].filter(id => selectableIds.has(id));
    if (ids.length === 0) return;
    const label = action === 'approve' ? '入库' : '拒绝';
    if (!confirm(`确认批量${label}选中的 ${ids.length} 道题？`)) return;
    try {
      await api.materials.batchReview(materialId, { action, questionIds: ids });
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      alert('操作失败：' + e.message);
    }
  };

  // ── 从列表跳转到逐题 ──
  const jumpToQuestion = (questionId: number) => {
    const idx = filteredQuestions.findIndex((q: any) => q.id === questionId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setReviewMode('detail');
      setEditMode(false);
    }
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
  const chapterPendingCount = (chId: number) =>
    material.questions?.filter((q: any) => q.chapterId === chId && q.reviewStatus === 'PENDING').length || 0;
  const chapterReviewedCount = (chId: number) =>
    material.questions?.filter((q: any) => q.chapterId === chId && q.reviewStatus !== 'PENDING').length || 0;

  // ── 题号导航条 ──
  const renderQuestionNav = () => {
    if (filteredQuestions.length <= 1) return null;
    return (
      <div ref={navRef}
        className="flex gap-1.5 overflow-x-auto pb-1 mb-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--ink-200) transparent',
        }}>
        {filteredQuestions.map((q: any, idx: number) => {
          const isCurrent = idx === currentIndex;
          let bg = 'transparent';
          let color = 'var(--ink-400)';
          let border = '1px solid var(--ink-200)';

          if (isCurrent) {
            bg = 'var(--fox)'; color = '#fff'; border = '1px solid var(--fox)';
          } else if (q.reviewStatus === 'APPROVED') {
            bg = 'var(--cyan-glow)'; color = 'var(--cyan)'; border = '1px solid var(--cyan)';
          } else if (q.reviewStatus === 'REJECTED') {
            bg = 'var(--verm-glow)'; color = 'var(--verm)'; border = '1px solid var(--verm)';
          } else if (q.reviewStatus === 'EDITED') {
            bg = 'var(--fox-pale)'; color = 'var(--fox-dark)'; border = '1px solid var(--fox)';
          }

          return (
            <button key={q.id} onClick={() => goToQuestion(idx)}
              className="w-7 h-7 rounded-md text-xs font-medium cursor-pointer flex-shrink-0 transition-all hover:scale-105"
              title={`#${idx + 1} ${q.reviewStatus === 'PENDING' ? '待审核' : q.reviewStatus === 'APPROVED' ? '已通过' : q.reviewStatus === 'REJECTED' ? '已拒绝' : '已修改'}`}
              style={{ background: bg, color, border }}>
              {idx + 1}
            </button>
          );
        })}
      </div>
    );
  };

  // ── 逐题审核模式 ──
  const renderDetailMode = () => {
    if (!current) {
      return (
        <div className="card p-10 text-center" style={{ color: 'var(--ink-300)' }}>
          {filteredQuestions.length === 0
            ? '📭 这一章还没有试题'
            : '🎉 这一章全部审核完毕！'}
        </div>
      );
    }

    return (
      <div className="animate-fadeSlide">
        {/* 进度条 */}
        <div className="flex items-center gap-3 mb-3">
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

        {/* 题号导航条 */}
        {renderQuestionNav()}

        {/* 试题卡片 */}
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

        {/* ── 操作按钮区 ── */}
        <div className="flex items-center gap-2">
          {/* 上一题 */}
          <button onClick={goPrev} disabled={!hasPrev}
            className="btn btn-outline btn-sm flex-shrink-0"
            style={{ opacity: hasPrev ? 1 : 0.35 }}>
            ← 上一题
          </button>

          <div className="flex-1 flex gap-2 justify-center">
            {current.reviewStatus === 'PENDING' && !editMode && (
              <>
                <button onClick={() => handleReview('REJECTED')}
                  className="btn btn-outline flex-1 py-2"
                  style={{ borderColor: 'var(--verm)', color: 'var(--verm)' }}>
                  拒绝 ✕
                </button>
                <button onClick={enterEdit}
                  className="btn btn-outline flex-1 py-2">
                  修改后入库 ✏️
                </button>
                <button onClick={() => handleReview('APPROVED')}
                  className="btn btn-fox flex-1 py-2">
                  确认入库 ✓
                </button>
              </>
            )}
            {current.reviewStatus === 'PENDING' && editMode && (
              <>
                <button onClick={() => setEditMode(false)}
                  className="btn btn-outline flex-1 py-2">取消修改</button>
                <button onClick={() => handleReview('EDITED')}
                  className="btn btn-fox flex-1 py-2">
                  保存修改并入库 💾
                </button>
              </>
            )}
            {current.reviewStatus !== 'PENDING' && (
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ink-400)' }}>
                <span>
                  {current.reviewStatus === 'APPROVED' ? '✅ 已入库' :
                   current.reviewStatus === 'REJECTED' ? '❌ 已拒绝' : '✏️ 已修改入库'}
                </span>
                {hasNext && (
                  <button onClick={goNext} className="btn btn-ghost btn-xs">下一题 →</button>
                )}
              </div>
            )}
          </div>

          {/* 下一题 */}
          <button onClick={goNext} disabled={!hasNext}
            className="btn btn-outline btn-sm flex-shrink-0"
            style={{ opacity: hasNext ? 1 : 0.35 }}>
            下一题 →
          </button>
        </div>

        {/* 已审完则显示回到顶部 */}
        {!hasNext && current.reviewStatus !== 'PENDING' && (
          <div className="text-center mt-4">
            <button onClick={() => goToQuestion(0)}
              className="btn btn-ghost btn-sm">回到第一题</button>
          </div>
        )}
      </div>
    );
  };

  // ── 列表预览模式 ──
  const renderListMode = () => {
    if (filteredQuestions.length === 0) {
      return (
        <div className="card p-10 text-center" style={{ color: 'var(--ink-300)' }}>
          📭 这一章还没有试题
        </div>
      );
    }

    return (
      <div>
        {/* 顶部工具条 */}
        <div className="flex items-center justify-between mb-3 px-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ink-500)' }}>
            <input type="checkbox"
              checked={pendingQuestions.length > 0 && selectedIds.size === pendingQuestions.length}
              onChange={toggleSelectAll}
              disabled={pendingQuestions.length === 0}
              className="cursor-pointer" />
            {pendingQuestions.length > 0
              ? `全选（${pendingQuestions.length} 道待审）`
              : '本章节已全部审核完成'}
          </label>
          {selectedPendingCount > 0 && (
            <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>
              已选 {selectedPendingCount} 题
            </span>
          )}
        </div>

        {/* 试题列表 */}
        <div className="space-y-1.5 mb-4">
          {filteredQuestions.map((q: any, idx: number) => {
            const isPending = q.reviewStatus === 'PENDING';
            const isSelected = selectedIds.has(q.id);

            let rowBg = 'transparent';
            let rowBorder = '1px solid var(--ink-100)';

            if (isPending && isSelected) {
              rowBg = 'var(--fox-pale)';
              rowBorder = '1px solid var(--fox)';
            } else if (q.reviewStatus === 'APPROVED') {
              rowBg = 'var(--cyan-glow)';
              rowBorder = '1px solid var(--cyan)';
            } else if (q.reviewStatus === 'REJECTED') {
              rowBg = 'rgba(222,82,72,0.04)';
              rowBorder = '1px solid var(--verm-glow)';
            } else if (q.reviewStatus === 'EDITED') {
              rowBg = 'var(--fox-pale)';
              rowBorder = '1px solid var(--fox-glow)';
            }

            return (
              <div key={q.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer hover:-translate-y-0.5"
                style={{ background: rowBg, border: rowBorder }}
                onClick={() => { if (!isPending || !isSelected) jumpToQuestion(q.id); }}>
                {/* Checkbox — 只有待审的才能勾 */}
                {isPending ? (
                  <span onClick={e => { e.stopPropagation(); toggleSelect(q.id); }}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${isSelected ? '' : ''}`}
                    style={{
                      borderColor: isSelected ? 'var(--fox)' : 'var(--ink-200)',
                      background: isSelected ? 'var(--fox)' : 'transparent',
                    }}>
                    {isSelected && <span className="text-white text-[10px]">✓</span>}
                  </span>
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-xs">
                    {q.reviewStatus === 'APPROVED' || q.reviewStatus === 'EDITED' ? '✅' : '❌'}
                  </span>
                )}

                {/* 序号 */}
                <span className="font-mono text-xs w-5 flex-shrink-0 text-center" style={{ color: 'var(--ink-300)' }}>
                  {idx + 1}
                </span>

                {/* 题型简短标签 */}
                <span className="tag tag-ink text-[10px] px-1.5 py-0.5 flex-shrink-0">
                  {TYPE_SHORT[q.type]}
                </span>

                {/* 难度点 */}
                <span className="flex-shrink-0" style={{ color: DIFF_COLORS[q.difficulty] }}>
                  {DIFF_LABELS[q.difficulty] === '易' ? '' : DIFF_LABELS[q.difficulty]}
                </span>

                {/* 知识点 */}
                {q.knowledgePoint && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--gold)' }}>
                    {q.knowledgePoint}
                  </span>
                )}

                {/* 题目内容 — 截断 */}
                <span className="flex-1 truncate" style={{ color: 'var(--ink-600)' }}>
                  {q.content}
                </span>

                {/* 状态标签 */}
                {!isPending && (
                  <span className={`text-[10px] font-medium flex-shrink-0 ${
                    q.reviewStatus === 'APPROVED' ? '' : q.reviewStatus === 'EDITED' ? '' : ''
                  }`}
                  style={{
                    color: q.reviewStatus === 'APPROVED' ? 'var(--cyan)' :
                           q.reviewStatus === 'REJECTED' ? 'var(--verm)' : 'var(--fox)',
                  }}>
                    {q.reviewStatus === 'APPROVED' ? '已入库' :
                     q.reviewStatus === 'REJECTED' ? '已拒绝' : '已修改'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 批量操作栏 */}
        {selectedPendingCount > 0 && (
          <div className="flex items-center justify-center gap-3 py-3 rounded-lg sticky bottom-0"
            style={{
              background: 'var(--paper)',
              borderTop: '1px solid var(--ink-100)',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
            }}>
            <span className="text-xs" style={{ color: 'var(--ink-400)' }}>
              已选 <strong style={{ color: 'var(--fox)' }}>{selectedPendingCount}</strong> 道待审试题
            </span>
            <button onClick={() => handleBatchReview('approve')}
              className="btn btn-fox btn-sm">
              批量入库 ✓
            </button>
            <button onClick={() => handleBatchReview('reject')}
              className="btn btn-outline btn-sm"
              style={{ borderColor: 'var(--verm)', color: 'var(--verm)' }}>
              批量拒绝 ✕
            </button>
          </div>
        )}
      </div>
    );
  };

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
            {reviewCounts.edited > 0 && <>&nbsp;·&nbsp; 已修改 {reviewCounts.edited}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'review' && material?.chapters?.some((ch: any) => ch.content) && !['PROCESSING', 'GENERATING'].includes(material?.status) && (
            <button onClick={async () => {
              if (!confirm('确认使用大模型生成试题？将覆盖该教材之前生成的所有试题。')) return;
              setGenerating(true);
              try {
                const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
                const token = localStorage.getItem('token');
                const res = await fetch(`${apiBase}/api/materials/${materialId}/generate`, {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) { const err = await res.text(); throw new Error(err); }
                const data = await res.json();
                alert(`AI 出题完成！生成了 ${data.total} 道试题（共 ${data.chapters} 个章节），请逐题审核。`);
                load();
              } catch (e: any) { alert('出题失败：' + e.message); }
              setGenerating(false);
            }} disabled={generating}
              className="btn btn-outline btn-sm">
              {generating ? '🤖 出题中…' : '🤖 AI生成试题'}
            </button>
          )}
          {material?.status === 'PROCESSING' && (
            <span className="text-xs self-center" style={{ color: 'var(--gold)' }}>⏳ 正在生成试题…</span>
          )}
          {reviewCounts.pending > 0 && (
            <button onClick={handleBatchImport} disabled={importing}
              className="btn btn-fox btn-sm">
              {importing ? '导入中…' : `一键导入全部 (${reviewCounts.pending})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab 导航 ── */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        {[
          { key: 'structure', label: '📖 章节结构', condition: true },
          { key: 'plan', label: '🤖 出题配置', condition: material.status !== 'UPLOADED' && material.status !== 'FAILED' },
          { key: 'review', label: '📝 试题审核', condition: totalQuestions > 0 || material.status === 'PROCESSING' || material.status === 'GENERATING' },
        ].filter(t => t.condition).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent"
            style={{
              borderColor: activeTab === tab.key ? 'var(--fox)' : 'transparent',
              color: activeTab === tab.key ? 'var(--ink-800)' : 'var(--ink-300)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 内容 ── */}
      {activeTab === 'structure' && (
        <ChapterStructureTab
          materialId={materialId}
          chapters={material.chapters || []}
          onConfirm={load}
        />
      )}

      {activeTab === 'plan' && (
        <QuestionPlanTab
          materialId={materialId}
          materialStatus={material.status}
          chapters={material.chapters || []}
          onGenerate={load}
        />
      )}

      {activeTab === 'review' && (
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
              <div key={ch.id} onClick={() => { setActiveChapter(ch.id); setCurrentIndex(0); setEditMode(false); setSelectedIds(new Set()); }}
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

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* 模式切换 */}
          <div className="flex items-center gap-1 mb-4 p-0.5 rounded-lg"
            style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
            <button onClick={() => setReviewMode('detail')}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                background: reviewMode === 'detail' ? 'var(--paper)' : 'transparent',
                color: reviewMode === 'detail' ? 'var(--fox)' : 'var(--ink-400)',
                boxShadow: reviewMode === 'detail' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              📝 逐题审核
            </button>
            <button onClick={() => setReviewMode('list')}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                background: reviewMode === 'list' ? 'var(--paper)' : 'transparent',
                color: reviewMode === 'list' ? 'var(--fox)' : 'var(--ink-400)',
                boxShadow: reviewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              📋 列表预览
            </button>
          </div>

          {reviewMode === 'detail' ? renderDetailMode() : renderListMode()}
        </div>

        {/* Right stats sidebar */}
        <div className="w-[180px] flex-shrink-0">
          <div className="card p-4 text-xs space-y-2 sticky top-4" style={{ color: 'var(--ink-400)' }}>
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
            {reviewCounts.edited > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--fox-dark)' }}>
                <span>已修改</span><span>{reviewCounts.edited}</span>
              </div>
            )}
            <hr className="divider" />
            <div className="font-semibold" style={{ color: 'var(--ink-600)' }}>💡 提示</div>
            {reviewMode === 'detail' ? (
              <>
                <p>可自由翻页浏览，不必立刻做决定。</p>
                <p>点击题号可快速跳转。</p>
              </>
            ) : (
              <>
                <p>勾选试题后批量操作。</p>
                <p>点标题进入逐题审核。</p>
              </>
            )}
          </div>
        </div>
      </div>
      )}

    </AppLayout>
  );
}
