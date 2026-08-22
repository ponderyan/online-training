'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import ReviewDetailMode from './review-detail-mode';
import ReviewListMode from './review-list-mode';

// 试题审核 Tab：章节侧栏 + 逐题审核/列表预览双模式 + 右侧汇总
export default function ReviewTab({ materialId, material, reviewCounts, onReload }: {
  materialId: number;
  material: any;
  reviewCounts: { all: number; pending: number; approved: number; rejected: number; edited: number };
  onReload: () => void;
}) {
  const toast = useToast();
  const [activeChapter, setActiveChapter] = useState<number | null>(() => material?.chapters?.[0]?.id ?? null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [reviewMode, setReviewMode] = useState<'detail' | 'list'>('detail');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // ★ 2026-08-22 B1：按来源出题计划筛选（'all' 全部 / 'none' 无来源旧题 / 计划id）
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const navRef = useRef<HTMLDivElement>(null);

  // ★ 2026-08-22 B1：来源计划选项（从题集里去重，旧题无计划归入"无来源"）
  const planOptions = (() => {
    const map = new Map<number, string>();
    let hasLegacy = false;
    for (const q of material?.questions || []) {
      if (q.planId && q.plan) map.set(q.plan.id, q.plan.name || `计划#${q.plan.id}`);
      else if (!q.planId) hasLegacy = true;
    }
    return { plans: [...map.entries()], hasLegacy };
  })();

  // ★ 2026-08-22 B1：先按计划筛，再按章节筛（审核池仍是"一教材一池"，筛选只是视图）
  const baseQuestions = (material?.questions || []).filter((q: any) => {
    if (filterPlan === 'all') return true;
    if (filterPlan === 'none') return !q.planId;
    return q.planId === Number(filterPlan);
  });

  const filteredQuestions = baseQuestions.filter(
    (q: any) => q.chapterId === activeChapter
  );
  const current = filteredQuestions[currentIndex];

  // 当前章节的待审/可选题
  const pendingQuestions = filteredQuestions.filter((q: any) => q.reviewStatus === 'PENDING');
  const selectableIds = new Set(pendingQuestions.map((q: any) => q.id));

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
      onReload();
      if (hasNext) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (e: any) {
      toast.error('操作失败：' + e.message);
    }
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
      onReload();
    } catch (e: any) {
      toast.error('操作失败：' + e.message);
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

  const chapterQuestionCount = (chId: number) =>
    baseQuestions.filter((q: any) => q.chapterId === chId && q.reviewStatus !== 'REJECTED').length || 0;
  const chapterPendingCount = (chId: number) =>
    baseQuestions.filter((q: any) => q.chapterId === chId && q.reviewStatus === 'PENDING').length || 0;
  const chapterReviewedCount = (chId: number) =>
    baseQuestions.filter((q: any) => q.chapterId === chId && q.reviewStatus !== 'PENDING').length || 0;

  return (
    <div className="flex gap-6 items-start">
      {/* Chapter sidebar */}
      <div className="w-[200px] flex-shrink-0 space-y-1">
        {/* ★ 2026-08-22 B1：来源计划筛选（试题溯源到出题计划） */}
        {(planOptions.plans.length > 0 || planOptions.hasLegacy) && (
          <select value={filterPlan}
            onChange={e => { setFilterPlan(e.target.value); setCurrentIndex(0); setSelectedIds(new Set()); }}
            className="input text-xs w-full mb-2">
            <option value="all">全部来源</option>
            {planOptions.plans.map(([pid, name]) => (
              <option key={pid} value={String(pid)}>📋 {name}</option>
            ))}
            {planOptions.hasLegacy && <option value="none">旧版/无来源</option>}
          </select>
        )}
        <div className="text-[var(--ink-400)] text-xs font-semibold mb-2 px-2">章节列表</div>
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
              <div className="text-[var(--ink-300)]">
                {total} 题
                {pending > 0 && <span className="text-[var(--fox)]"> · {pending} 待审</span>}
                {reviewed > 0 && <span className="text-[var(--cyan)]"> · {reviewed} 已审</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* 模式切换 */}
        <div className="flex items-center gap-1 mb-4 p-0.5 rounded-lg bg-[var(--paper-dark)]"
          style={{  width: 'fit-content' }}>
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

        {reviewMode === 'detail' ? (
          <ReviewDetailMode
            filteredQuestions={filteredQuestions}
            currentIndex={currentIndex}
            goToQuestion={goToQuestion}
            goPrev={goPrev}
            goNext={goNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            editMode={editMode}
            setEditMode={setEditMode}
            editData={editData}
            setEditData={setEditData}
            handleReview={handleReview}
            enterEdit={enterEdit}
            navRef={navRef}
          />
        ) : (
          <ReviewListMode
            filteredQuestions={filteredQuestions}
            pendingQuestions={pendingQuestions}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            selectedPendingCount={selectedPendingCount}
            handleBatchReview={handleBatchReview}
            jumpToQuestion={jumpToQuestion}
          />
        )}
      </div>

      {/* Right stats sidebar */}
      <div className="w-[180px] flex-shrink-0">
        <div className="text-[var(--ink-400)] card p-4 text-xs space-y-2 sticky top-4">
          <div className="text-[var(--ink-600)] font-semibold mb-1">📊 汇总</div>
          <div className="flex justify-between"><span>全部试题</span><span>{reviewCounts.all}</span></div>
          <div className="text-[var(--fox)] flex justify-between">
            <span>待审核</span><span>{reviewCounts.pending}</span>
          </div>
          <div className="text-[var(--cyan)] flex justify-between">
            <span>已通过</span><span>{reviewCounts.approved}</span>
          </div>
          <div className="text-[var(--verm)] flex justify-between">
            <span>已拒绝</span><span>{reviewCounts.rejected}</span>
          </div>
          {reviewCounts.edited > 0 && (
            <div className="text-[var(--fox-dark)] flex justify-between">
              <span>已修改</span><span>{reviewCounts.edited}</span>
            </div>
          )}
          <hr className="divider" />
          <div className="text-[var(--ink-600)] font-semibold">💡 提示</div>
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
  );
}
