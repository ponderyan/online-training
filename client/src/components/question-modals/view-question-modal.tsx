'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TYPE_NAMES, DIFF_NAMES } from './question-modal-constants';

export function ViewQuestionModal({ open, onClose, question }: { open: boolean; onClose: () => void; question: any }) {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (question && open) {
      setLoading(true);
      api.questions.getReferencedPapers(question.id)
        .then(data => setPapers(data.papers || []))
        .catch(() => setPapers([]))
        .finally(() => setLoading(false));
    }
  }, [question, open]);

  if (!open || !question) return null;

  const typeName = TYPE_NAMES[question.type] || question.type;
  const diffName = DIFF_NAMES[question.difficulty] || question.difficulty;
  const sourceMap: Record<string, string> = { MANUAL: '手动录入', AI_IMPORT: 'AI生成', BATCH_IMPORT: '批量导入' };

  const diffTag = (d: string) => {
    switch (d) {
      case 'EASY': return 'tag-cyan';
      case 'MEDIUM_EASY': return 'tag-gold';
      case 'MEDIUM_HARD': return 'tag-ink';
      case 'HARD': return 'tag-verm';
      default: return 'tag-ink';
    }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '—';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card max-w-[640px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">试题详情</h3>
          <button onClick={onClose} className="text-[var(--ink-300)] text-lg bg-transparent border-none cursor-pointer">✕</button>
        </div>

        <div className="modal-body space-y-4">
          {/* 元数据标签行 */}
          <div className="flex flex-wrap gap-2">
            <span className="tag tag-ink">{typeName}</span>
            <span className={`tag ${diffTag(question.difficulty)}`}>{diffName}</span>
            <span className="tag tag-gold">{question.subject?.code}</span>
            {question.chapter && <span className="tag bg-[var(--fox-glow)] text-[var(--fox-dark)]" >{question.chapter.name}</span>}
            <span className="tag tag-ink">{sourceMap[question.source] || question.source}</span>
            <span className={`tag ${question.status === 'PUBLISHED' ? 'tag-cyan' : 'tag-verm'}`}>
              {question.status === 'PUBLISHED' ? '启用' : '停用'}
            </span>
          </div>

          {/* ── 来源教材信息（蓝绿卡片，有教材关联） ── */}
          {question.materialQuestions?.[0]?.material && (
            <div className="rounded-lg px-4 py-3 flex items-center gap-3 bg-[var(--info-pale)]"
              style={{  border: '1px solid color-mix(in srgb, var(--info) 35%, transparent)' }}>
              <span style={{ fontSize: '18px' }}>📖</span>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--info)]" style={{ fontSize: '13px', fontWeight: 600,  }}>
                  {question.materialQuestions[0].material.name}
                </div>
                {question.materialQuestions[0].chapter?.title && (
                  <div className="text-[var(--info)]" style={{ fontSize: '11px',  marginTop: '1px' }}>
                    {question.materialQuestions[0].chapter.title}
                  </div>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--info-pale)] text-[var(--info)]" style={{   whiteSpace: 'nowrap' }}>
                结构化出题
              </span>
            </div>
          )}
          {/* ── 已归档来源（金色卡片） ── */}
          {question.sourceNote && !question.materialQuestions?.[0]?.material && (
            <div className="rounded-lg px-4 py-3 flex items-center gap-3 bg-[var(--fox-pale)]"
              style={{  border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)' }}>
              <span style={{ fontSize: '18px' }}>🗂️</span>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--gold)]" style={{ fontSize: '13px', fontWeight: 600,  }}>
                  {question.sourceNote}
                </div>
                <div className="text-[var(--gold-light)]" style={{ fontSize: '11px',  marginTop: '1px' }}>
                  该教材已归档，试题信息保留
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--gold-light)] text-[var(--gold)]" style={{   whiteSpace: 'nowrap' }}>
                已归档
              </span>
            </div>
          )}

          {/* 题干 */}
          <div className="bg-[var(--paper)] p-4 rounded text-sm leading-relaxed">
            {question.content}
          </div>

          {/* 选项（选择题） */}
          {question.options?.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[var(--ink-500)] text-xs font-medium mb-1">选项</div>
              {question.options.map((o: any) => (
                <div key={o.id} className="px-3 py-2 rounded text-sm"
                  style={{
                    background: o.isCorrect ? 'var(--cyan-glow)' : 'var(--paper)',
                    border: o.isCorrect ? '1px solid rgba(0, 201, 182, 0.3)' : '1px solid transparent',
                  }}>
                  <span className="font-medium">{o.label}.</span> {o.content}
                  {o.isCorrect && <span className="text-[var(--cyan)] ml-1 text-xs">✓ 正确答案</span>}
                </div>
              ))}
            </div>
          )}

          {/* 填空 */}
          {question.blanks?.length > 0 && (
            <div>
              <div className="text-[var(--ink-500)] text-xs font-medium mb-1.5">填空答案</div>
              <div className="flex flex-wrap gap-2">
                {question.blanks.map((b: any, i: number) => (
                  <span key={b.id} className="tag tag-gold">空{i + 1}: {b.answer}</span>
                ))}
              </div>
            </div>
          )}

          {/* 简答/案例 参考答案 */}
          {['SHORT_ANSWER', 'CASE_STUDY'].includes(question.type) && question.analysis && (
            <div>
              <div className="text-[var(--ink-500)] text-xs font-medium mb-1">参考答案</div>
              <div className="p-3 rounded text-sm bg-[var(--cyan-glow)] text-[var(--ink-700)]" >
                {question.analysis}
              </div>
            </div>
          )}

          {/* 解析 */}
          {question.analysis && !['SHORT_ANSWER', 'CASE_STUDY'].includes(question.type) && (
            <div>
              <div className="text-[var(--fox)] text-xs font-medium mb-1">解析</div>
              <div className="p-3 rounded text-sm bg-[var(--fox-pale)] text-[var(--ink-700)]" >
                {question.analysis}
              </div>
            </div>
          )}

          {/* 子问题（案例题） */}
          {question.subQuestions?.length > 0 && (
            <div>
              <div className="text-[var(--ink-500)] text-xs font-medium mb-1.5">子问题</div>
              <div className="space-y-2">
                {question.subQuestions.map((sq: any, i: number) => (
                  <div key={sq.id} className="bg-[var(--paper)] p-3 rounded text-sm">
                    <div className="font-medium mb-1">({i + 1}) {sq.content}{sq.score ? `（${sq.score}分）` : ''}</div>
                    {sq.answer && <div className="text-[var(--cyan)] text-xs">答案：{sq.answer}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 元信息 */}
          <div className="pt-4 border-t text-xs space-y-1.5 border-[var(--ink-100)] text-[var(--ink-400)]" >
            {question.materialQuestions?.[0]?.material && (
              <div className="flex justify-between">
                <span>来源教材</span>
                <span className="text-[var(--ink-700)]" style={{  fontWeight: 500 }}>
                  {question.materialQuestions[0].material.name}
                  {question.materialQuestions[0].chapter?.title ? ` · ${question.materialQuestions[0].chapter.title}` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>创建时间</span>
              <span>{fmtDate(question.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>最后修改</span>
              <span>{fmtDate(question.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>使用次数</span>
              <span>{question.usageCount || 0} 次</span>
            </div>
            <div className="flex justify-between">
              <span>引用试卷</span>
              <span>{papers.length} 份</span>
            </div>
          </div>

          {/* 引用试卷列表 */}
          {papers.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[var(--ink-500)] text-xs font-medium">出现在以下试卷中：</div>
              {papers.map((p: any, i: number) => (
                <div key={i} className="bg-[var(--paper)] flex items-center justify-between px-3 py-2 rounded text-xs">
                  <span className="text-[var(--ink-600)] truncate flex-1">{p.name}</span>
                  <span className="text-[var(--ink-300)] ml-3">{p.paperNumber}</span>
                  <span className={`tag ml-2 ${
                    p.status === 'OFFICIAL' ? 'tag-verm' :
                    p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                  }`}>{p.status === 'OFFICIAL' ? '正式' : p.status === 'FINALIZED' ? '定稿' : '草稿'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
