'use client';

import { useEffect, type RefObject } from 'react';
import { TYPE_NAMES, DIFF_LABELS, DIFF_COLORS, GROUP_NAMES } from './review-constants';

// 逐题审核模式：进度条 + 题号导航 + 试题卡片（查看/编辑）+ 操作按钮区
export default function ReviewDetailMode({
  filteredQuestions, currentIndex, goToQuestion, goPrev, goNext, hasPrev, hasNext,
  editMode, setEditMode, editData, setEditData, handleReview, enterEdit, navRef,
}: {
  filteredQuestions: any[];
  currentIndex: number;
  goToQuestion: (idx: number) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  editData: any;
  setEditData: (v: any) => void;
  handleReview: (status: 'APPROVED' | 'REJECTED' | 'EDITED', extra?: any) => void;
  enterEdit: () => void;
  navRef: RefObject<HTMLDivElement | null>;
}) {
  const current = filteredQuestions[currentIndex];

  // 滚动导航条使当前题号可见
  useEffect(() => {
    if (!navRef.current) return;
    const btns = navRef.current.querySelectorAll('button');
    if (btns[currentIndex]) {
      btns[currentIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex, navRef]);

  if (!current) {
    return (
      <div className="text-[var(--ink-300)] card p-10 text-center">
        {filteredQuestions.length === 0
          ? '📭 这一章还没有试题'
          : '🎉 这一章全部审核完毕！'}
      </div>
    );
  }

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

  return (
    <div className="animate-fadeSlide">
      {/* 进度条 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-[var(--paper-dark)] flex-1 h-1.5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all bg-[var(--fox)]"
            style={{
              width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%`,
              
            }} />
        </div>
        <span className="text-[var(--ink-400)] text-xs flex-shrink-0">
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
            <span className="text-[var(--ink-300)] text-xs">📄 {current.sourceChunk}</span>
          )}
        </div>

        {/* Question content - view mode */}
        {!editMode ? (
          <>
            <div className="text-[var(--ink-700)] text-sm mb-4 leading-relaxed">
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

            {current.subQuestions && Array.isArray(current.subQuestions) && current.subQuestions.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-[var(--ink-500)] text-xs font-semibold">案例小问 · {current.subQuestions.length} 问</div>
                {current.subQuestions.map((sq: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--paper)] text-sm" style={{ border: '1px solid var(--ink-100)' }}>
                    <div className="text-[var(--ink-700)]">
                      <span className="font-mono font-bold text-[var(--fox)] mr-1">{i + 1}.</span>
                      {sq.content}
                      {sq.score != null && <span className="ml-2 text-xs text-[var(--gold)]">（{sq.score}分）</span>}
                    </div>
                    {sq.answer && (
                      <div className="text-xs text-[var(--ink-400)] mt-1.5 pl-5">参考答案：{sq.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {current.answer && (
              <div className="mb-3">
                <div className="text-[var(--cyan)] text-xs font-semibold mb-1">参考答案</div>
                <div className="text-sm p-3 rounded-lg bg-[var(--cyan-glow)] text-[var(--ink-700)]" >
                  {current.answer}
                </div>
              </div>
            )}
            {current.explanation && (
              <div className="mb-3">
                <div className="text-[var(--fox)] text-xs font-semibold mb-1">解析</div>
                <div className="text-sm p-3 rounded-lg bg-[var(--fox-pale)] text-[var(--ink-700)]" >
                  {current.explanation}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">题干</label>
              <textarea value={editData.content} onChange={e => setEditData({ ...editData, content: e.target.value })}
                className="input textarea" rows={3} />
            </div>
            {current.options && Array.isArray(current.options) && (
              <div>
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">选项</label>
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
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">参考答案</label>
                <textarea value={editData.answer} onChange={e => setEditData({ ...editData, answer: e.target.value })}
                  className="input textarea" rows={2} />
              </div>
              <div>
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">解析</label>
                <textarea value={editData.explanation} onChange={e => setEditData({ ...editData, explanation: e.target.value })}
                  className="input textarea" rows={2} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">难度</label>
                <select value={editData.difficulty} onChange={e => setEditData({ ...editData, difficulty: e.target.value })}
                  className="input select">
                  {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">分组</label>
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
                className="btn btn-outline flex-1 py-2 border-[var(--verm)] text-[var(--verm)]"
                >
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
            <div className="text-[var(--ink-400)] flex items-center gap-3 text-xs">
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
}
