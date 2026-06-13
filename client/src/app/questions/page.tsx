'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { AddQuestionModal, ViewQuestionModal } from '@/components/question-modals';
import QuestionImportModal from '@/components/question-import-modal';
import { api } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选', MULTIPLE_CHOICE: '多选', TRUE_FALSE: '判断',
  FILL_BLANK: '填空', SHORT_ANSWER: '简答', CASE_STUDY: '案例',
};
const DIFF_LABELS: Record<string, { label: string; cls: string }> = {
  EASY: { label: '易', cls: 'tag-cyan' },
  MEDIUM_EASY: { label: '较易', cls: 'tag-gold' },
  MEDIUM_HARD: { label: '较难', cls: 'tag-ink' },
  HARD: { label: '难', cls: 'tag-verm' },
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [viewQuestion, setViewQuestion] = useState<any>(null);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);

  const pageSize = 20;

  const load = useCallback(async () => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (keyword) params.keyword = keyword;
    if (filterType) params.type = filterType;
    if (filterDifficulty) params.difficulty = filterDifficulty;
    if (filterSubject) params.subjectId = filterSubject;

    const data = await api.questions.list(params);
    setQuestions(data.items);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  }, [page, keyword, filterType, filterDifficulty, filterSubject]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.subjects.list().then(setSubjects).catch(() => {}); }, []);

  const toggleStatus = async (q: any) => {
    const newStatus = q.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    await api.questions.update(q.id, { status: newStatus });
    load();
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 4) {
      for (let i = 1; i <= 7; i++) pages.push(i);
    } else if (page >= totalPages - 3) {
      for (let i = totalPages - 6; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = page - 3; i <= page + 3; i++) pages.push(i);
    }
    return pages;
  };

  return (
    <AppLayout>
      {/* 页面标题 */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="page-title">题库管理</h1>
          <p className="page-subtitle">共 {total} 道试题 · 6 种题型 · {subjects.length} 个科目</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm">↑ 批量导入</button>
          <button onClick={() => setShowAdd(true)} className="btn btn-gold btn-sm">+ 录入试题</button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: 'var(--ink-300)' }}>⌕</span>
          <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
            placeholder="搜索题干…" className="input" style={{ paddingLeft: '32px' }} />
        </div>
        <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
          className="input select" style={{ width: '120px' }}>
          <option value="">全部科目</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="input select" style={{ width: '100px' }}>
          <option value="">全部题型</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); setPage(1); }}
          className="input select" style={{ width: '100px' }}>
          <option value="">全部难度</option>
          {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* 表格 */}
      <div className="card overflow-hidden">
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>试题内容</th>
              <th style={{ width: '8%' }}>题型</th>
              <th style={{ width: '8%' }}>难度</th>
              <th style={{ width: '8%' }}>科目</th>
              <th style={{ width: '8%' }}>状态</th>
              <th style={{ width: '8%' }}>引用</th>
              <th style={{ width: '8%' }}>来源</th>
              <th style={{ width: '12%' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--ink-300)' }}>暂无试题</td></tr>
            ) : questions.map((q: any) => (
              <tr key={q.id}>
                <td><span className="line-clamp-1">{q.content}</span></td>
                <td><span className="tag tag-ink">{TYPE_LABELS[q.type]}</span></td>
                <td><span className={`tag ${DIFF_LABELS[q.difficulty]?.cls}`}>{DIFF_LABELS[q.difficulty]?.label}</span></td>
                <td><span className="tag tag-gold">{q.subject?.code}</span></td>
                <td>
                  <span className={`tag ${q.status === 'PUBLISHED' ? 'tag-cyan' : 'tag-verm'}`}>
                    {q.status === 'PUBLISHED' ? '启用' : '停用'}
                  </span>
                </td>
                <td style={{ color: 'var(--ink-500)' }}>{q._count?.paperQuestions || 0}次</td>
                <td style={{ color: 'var(--ink-500)' }}>
                  {q.source === 'MANUAL' ? '手动' : q.source === 'AI_IMPORT' ? 'AI' : '批量'}
                </td>
                <td>
                  <div className="flex gap-1.5">
                    <button onClick={() => setViewQuestion(q)} className="btn btn-xs btn-ghost">查</button>
                    <button onClick={() => setEditQuestion(q)} className="btn btn-xs btn-ghost">改</button>
                    <button onClick={() => toggleStatus(q)}
                      className={`btn btn-xs ${q.status === 'PUBLISHED' ? 'btn-ghost' : 'btn-ghost'}`}
                      style={{ color: q.status === 'PUBLISHED' ? 'var(--verm)' : 'var(--cyan)' }}>
                      {q.status === 'PUBLISHED' ? '停用' : '启用'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4" style={{ color: 'var(--ink-400)' }}>
          <span className="text-xs">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条 / 共 {total} 条
          </span>
          <div className="flex gap-1.5">
            {getPageNumbers().map(p => (
              <button key={p} onClick={() => setPage(p)}
                className="btn btn-xs"
                style={{
                  background: p === page ? 'var(--ink-900)' : 'transparent',
                  color: p === page ? '#f6f1e8' : 'var(--ink-500)',
                  border: p === page ? 'none' : '1px solid var(--ink-100)',
                  minWidth: '32px',
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <AddQuestionModal open={showAdd || !!editQuestion} onClose={() => { setShowAdd(false); setEditQuestion(null); load(); }} subjects={subjects} editQuestion={editQuestion} />
      <ViewQuestionModal open={!!viewQuestion} onClose={() => setViewQuestion(null)} question={viewQuestion} />
      <QuestionImportModal open={showImport} onClose={() => { setShowImport(false); load(); }} subjects={subjects} />
    </AppLayout>
  );
}
