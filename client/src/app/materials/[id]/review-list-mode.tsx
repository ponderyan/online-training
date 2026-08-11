'use client';

import { TYPE_SHORT, DIFF_LABELS, DIFF_COLORS } from './review-constants';

// 列表预览模式：全选工具条 + 试题行列表 + 批量操作栏
export default function ReviewListMode({
  filteredQuestions, pendingQuestions, selectedIds, toggleSelect, toggleSelectAll,
  selectedPendingCount, handleBatchReview, jumpToQuestion,
}: {
  filteredQuestions: any[];
  pendingQuestions: any[];
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  toggleSelectAll: () => void;
  selectedPendingCount: number;
  handleBatchReview: (action: 'approve' | 'reject') => void;
  jumpToQuestion: (questionId: number) => void;
}) {
  if (filteredQuestions.length === 0) {
    return (
      <div className="text-[var(--ink-300)] card p-10 text-center">
        📭 这一章还没有试题
      </div>
    );
  }

  return (
    <div>
      {/* 顶部工具条 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="text-[var(--ink-500)] flex items-center gap-2 text-xs cursor-pointer">
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
          <span className="text-[var(--fox)] text-xs font-medium">
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
              <span className="text-[var(--ink-300)] font-mono text-xs w-5 flex-shrink-0 text-center">
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
                <span className="text-[var(--gold)] text-xs flex-shrink-0">
                  {q.knowledgePoint}
                </span>
              )}

              {/* 题目内容 — 截断 */}
              <span className="text-[var(--ink-600)] flex-1 truncate">
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
        <div className="flex items-center justify-center gap-3 py-3 rounded-lg sticky bottom-0 bg-[var(--paper)]"
          style={{
            
            borderTop: '1px solid var(--ink-100)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
          }}>
          <span className="text-[var(--ink-400)] text-xs">
            已选 <strong className="text-[var(--fox)]">{selectedPendingCount}</strong> 道待审试题
          </span>
          <button onClick={() => handleBatchReview('approve')}
            className="btn btn-fox btn-sm">
            批量入库 ✓
          </button>
          <button onClick={() => handleBatchReview('reject')}
            className="btn btn-outline btn-sm border-[var(--verm)] text-[var(--verm)]"
            >
            批量拒绝 ✕
          </button>
        </div>
      )}
    </div>
  );
}
