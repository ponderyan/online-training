'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
// 可选的每页条数（用户也可手动输入任意值）
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [viewQuestion, setViewQuestion] = useState<any>(null);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const router = useRouter();
  const [referencedPapers, setReferencedPapers] = useState<any>(null);
  const [loadingRefs, setLoadingRefs] = useState(false);

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
  }, [page, pageSize, keyword, filterType, filterDifficulty, filterSubject]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.subjects.list().then(setSubjects).catch(() => {}); }, []);

  const toggleStatus = async (q: any) => {
    const newStatus = q.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    await api.questions.update(q.id, { status: newStatus });
    load();
  };

  const handleDelete = async (q: any) => {
    // 先查引用
    try {
      const refs = await api.questions.getReferencedPapers(q.id);
      if (refs.count > 0) {
        alert(`该试题已被 ${refs.count} 份试卷引用，无法删除。\n\n建议：使用「停用」功能将其归档，已引用的试卷不受影响。`);
        return;
      }
    } catch {}

    if (!confirm(`确认永久删除此题？\n\n「${q.content?.slice(0, 40)}…」\n\n此操作不可撤销！`)) return;
    if (!confirm('⚠️ 再次确认：删除后数据不可恢复，确定要永久删除吗？')) return;

    try {
      await api.questions.delete(q.id);
      load();
    } catch (e: any) {
      alert('删除失败：' + e.message);
    }
  };

  const openEditModal = async (q: any) => {
    setEditingLoading(true);
    try {
      // 获取完整数据（含选项、答案、解析）
      const full = await api.questions.get(q.id);
      setEditQuestion(full);
    } catch {
      setEditQuestion(q);
    }
    setEditingLoading(false);
  };

  const showReferencedPapers = async (questionId: number) => {
    setLoadingRefs(true);
    setReferencedPapers(null);
    try {
      const data = await api.questions.getReferencedPapers(questionId);
      setReferencedPapers(data);
    } catch (e: any) {
      alert('查询失败：' + e.message);
    }
    setLoadingRefs(false);
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

  const handleRowDoubleClick = (q: any) => {
    setViewQuestion(q);
  };

  // 选题模式
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goGenerateWithSelected = () => {
    if (selectedIds.size === 0) { alert('请先勾选试题'); return; }
    // 存储选中试题的 ID 和题型（用于锁定题型）
    const selectedData = questions.filter(q => selectedIds.has(q.id)).map(q => ({
      id: q.id,
      type: q.type,
    }));
    localStorage.setItem('selectedQuestionData', JSON.stringify(selectedData));
    router.push('/generate');
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  return (
    <AppLayout>
      {/* ── 页面标题 ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="page-title">🦊 题库管理</h1>
          <p className="page-subtitle">共 {total} 道试题 · 6 种题型 · {subjects.length} 个科目</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm">↑ 批量导入</button>
          <button onClick={() => setShowAdd(true)} className="btn btn-fox btn-sm">+ 录入试题</button>
        </div>
      </div>

      {/* ── 筛选栏 ── */}
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

      {/* ── 表格 ── */}
      <div className="card overflow-hidden">
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center' }}>
                <input type="checkbox" checked={selectMode} onChange={() => {
                  if (selectMode) { setSelectedIds(new Set()); setSelectMode(false); }
                  else { setSelectMode(true); setSelectedIds(new Set(questions.map(q => q.id))); }
                }}
                  style={{ cursor: 'pointer', accentColor: '#e87a30' }} />
              </th>
              <th style={{ width: '38px', textAlign: 'center' }}>#</th>
              <th style={{ width: '30%' }}>试题内容</th>
              <th style={{ width: '7%' }}>题型</th>
              <th style={{ width: '7%' }}>难度</th>
              <th style={{ width: '6%' }}>科目</th>
              <th style={{ width: '7%' }}>来源</th>
              <th style={{ width: '8%' }}>创建时间</th>
              <th style={{ width: '5%' }}>状态</th>
              <th style={{ width: '5%' }}>引用</th>
              <th style={{ width: '14%' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12" style={{ color: 'var(--ink-300)' }}>
                小狐狸还没找到试题呢 🦊<br/>
                <span className="text-xs mt-2 block">点击右上角「录入试题」开始吧</span>
              </td></tr>
            ) : questions.map((q: any, idx: number) => (
              <tr key={q.id}
                onDoubleClick={() => handleRowDoubleClick(q)}
                className="cursor-pointer"
                style={{
                  background: selectedIds.has(q.id) ? 'var(--fox-pale)' : undefined,
                  opacity: q.status === 'ARCHIVED' ? 0.5 : undefined,
                }}>
                <td className="text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)}
                    style={{ cursor: 'pointer', accentColor: '#e87a30' }} />
                </td>
                <td className="text-center text-xs" style={{ color: 'var(--ink-300)', fontFamily: 'monospace' }}>
                  {(page - 1) * pageSize + idx + 1}
                </td>
                <td>
                  <span className="line-clamp-1 text-sm">{q.content}</span>
                </td>
                <td><span className="tag tag-ink">{TYPE_LABELS[q.type]}</span></td>
                <td><span className={`tag ${DIFF_LABELS[q.difficulty]?.cls}`}>{DIFF_LABELS[q.difficulty]?.label}</span></td>
                <td><span className="tag tag-gold">{q.subject?.code}</span></td>
                <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                  {q.source === 'MANUAL' ? '手动' : q.source === 'AI_IMPORT' ? 'AI' : '批量导入'}
                </td>
                <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                  {q.createdAt ? new Date(q.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—'}
                </td>
                <td>
                  <span className={`tag ${q.status === 'PUBLISHED' ? 'tag-cyan' : 'tag-ink'}`}>
                    {q.status === 'PUBLISHED' ? '启用' : '已停用'}
                  </span>
                </td>
                <td>
                  <span className="text-xs cursor-pointer hover:text-[var(--fox)] transition-colors"
                    style={{ color: q._count?.paperQuestions > 0 ? 'var(--ink-500)' : 'var(--ink-200)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (q._count?.paperQuestions > 0) showReferencedPapers(q.id);
                    }}>
                    {q._count?.paperQuestions || 0}次
                  </span>
                </td>
                <td>
                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); setViewQuestion(q); }}
                      className="btn btn-xs btn-ghost">详情</button>
                    <button onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                      className="btn btn-xs btn-ghost">{editingLoading ? '…' : '修改'}</button>
                    {q.status === 'PUBLISHED' ? (
                      <button onClick={(e) => { e.stopPropagation(); toggleStatus(q); }}
                        className="btn btn-xs" style={{ color: 'var(--verm)' }}>停用</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); toggleStatus(q); }}
                        className="btn btn-xs" style={{ color: 'var(--cyan)' }}>启用</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(q); }}
                      className="btn btn-xs btn-ghost" style={{ color: 'var(--ink-300)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 选题操作栏 ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-center gap-4 mt-4 p-3 rounded-lg animate-fadeSlide"
          style={{ background: 'var(--fox-glow)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--fox-dark)' }}>
            已选 <strong>{selectedIds.size}</strong> 道试题
          </span>
          <button onClick={goGenerateWithSelected} className="btn btn-fox btn-sm">选题组卷 →</button>
          <button onClick={clearSelection} className="btn btn-ghost btn-xs">取消选择</button>
        </div>
      )}

      {/* ── 分页（居中） ── */}
      <div className="flex flex-col items-center mt-4 gap-2" style={{ color: 'var(--ink-400)' }}>
        <div className="flex items-center gap-2 text-xs">
          <span>显示</span>
          <input value={pageSize} onChange={e => {
            const v = parseInt(e.target.value) || 0;
            if (v > 0 && v <= 500) { setPageSize(v); setPage(1); }
          }}
            className="input text-xs text-center"
            style={{ width: '56px', padding: '4px 6px' }}
            inputMode="numeric" />
          <span>条 / 页，共 {total} 条</span>
          <span className="ml-2" style={{ color: 'var(--ink-200)' }}>
            （第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条）
          </span>
        </div>
        {totalPages > 1 && (
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
        )}
      </div>

      <AddQuestionModal open={showAdd || !!editQuestion} onClose={() => { setShowAdd(false); setEditQuestion(null); load(); }} subjects={subjects} editQuestion={editQuestion} />
      <ViewQuestionModal open={!!viewQuestion} onClose={() => setViewQuestion(null)} question={viewQuestion} />
      <QuestionImportModal open={showImport} onClose={() => { setShowImport(false); load(); }} subjects={subjects} />

      {/* 引用详情弹窗 */}
      {referencedPapers !== null && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReferencedPapers(null); }}>
          <div className="modal-card max-w-[500px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">📋 引用详情</h3>
              <button onClick={() => setReferencedPapers(null)}
                className="text-lg bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body">
              <p className="text-xs mb-4" style={{ color: 'var(--ink-400)' }}>
                该试题已被引用 <strong>{referencedPapers?.count || 0}</strong> 次，共出现在以下试卷中：
              </p>
              {loadingRefs ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--ink-300)' }}>查询中…</p>
              ) : referencedPapers?.papers?.length > 0 ? (
                <div className="space-y-2">
                  {referencedPapers.papers.map((p: any, i: number) => (
                    <div key={i}
                      onClick={() => { setReferencedPapers(null); router.push(`/papers/${p.paperId}`); }}
                      className="flex items-center justify-between p-3 rounded-lg text-sm cursor-pointer transition-colors"
                      style={{ background: 'var(--paper)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--fox-glow)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--paper)'}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium" style={{ color: 'var(--ink-700)' }}>{p.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-300)' }}>{p.paperNumber}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs" style={{ color: 'var(--ink-400)' }}>{p.score}分</span>
                        <span className={`tag ${
                          p.status === 'OFFICIAL' ? 'tag-verm' :
                          p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                        }`}>
                          {p.status === 'OFFICIAL' ? '正式' : p.status === 'FINALIZED' ? '定稿' : '草稿'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-4" style={{ color: 'var(--ink-300)' }}>
                  该试题暂未被任何试卷引用
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setReferencedPapers(null)} className="btn btn-ink btn-sm">关闭</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
