'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { FileText, Plus, Sparkles, Search } from 'lucide-react';

export default function PapersPage() {
  const router = useRouter();
  const toast = useToast();
  const [papers, setPapers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<any>(null);
  const [moreMenu, setMoreMenu] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [paginationInfo, setPaginationInfo] = useState<any>(null);

  const load = async (p: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (keyword) params.set('keyword', keyword);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSubject) params.set('subjectId', filterSubject);
      if (filterOrg) params.set('orgId', filterOrg);
      const data = await api.papers.list(params.toString());
      setPapers(data.items || []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setPaginationInfo(data);
    } catch (e: any) {
      setError(e.message || '加载试卷列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(1); api.subjects.listActive().then(setSubjects).catch(() => {}); fetch('/api/organizations', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(r => r.json()).then(d => setOrgs(Array.isArray(d) ? d : d.items || [])).catch(() => {}); }, []);

  const goPage = (p: number) => { if (p >= 1 && p <= totalPages) load(p); };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'OFFICIAL': return '正式考卷';
      case 'FINALIZED': return '已定稿';
      case 'PENDING_REVIEW': return '待审核';
      case 'ARCHIVED': return '已归档';
      default: return '草稿';
    }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    try {
      await api.papers.delete(id);
      toast.success('试卷已删除');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error('删除失败：' + e.message);
      setDeleteTarget(null);
    }
  };

  const openAnswer = async (p: any) => {
    try { const full = await api.papers.get(p.id); setShowAnswer(full); }
    catch { setShowAnswer(p); }
  };

  const getToken = () => localStorage.getItem('token') || '';
  const handleDownload = (paperId: number, format: 'word' | 'pdf') => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-${format}?token=${getToken()}`;
    a.click();
  };

  const handleAnswerSheet = (paperId: number) => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-answer-sheet?token=${getToken()}`;
    a.download = `answer-sheet-${paperId}.docx`;
    a.click();
  };

  const handleUploadWord = async (file: File, paperId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/papers/${paperId}/upload-word`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('上传失败');
      toast.success('Word 上传成功，PDF 已生成');
    } catch (e: any) {
      toast.error('上传失败：' + e.message);
    }
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(prev => prev.length === papers.length ? [] : papers.map(p => p.id));

  const handleBatchStatus = async (status: string) => {
    if (!selectedIds.length) return;
    try {
      const res = await api.papers.batchStatus(selectedIds, status);
      toast.success(`已更新 ${res.updated} 套试卷`);
      setSelectedIds([]);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`确认删除选中的 ${selectedIds.length} 套试卷？此操作不可恢复。`)) return;
    try {
      const res = await api.papers.batchDelete(selectedIds);
      toast.success(`已删除 ${res.deleted} 套试卷`);
      setSelectedIds([]);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleArchive = async (id: number) => {
    try { await api.papers.archive(id); toast.success('已归档'); load(); } catch (e: any) { toast.error(e.message); }
  };
  const handleRestore = async (id: number) => {
    try { await api.papers.restore(id); toast.success('已恢复为草稿'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const draftCount = papers.filter(p => p.status === 'DRAFT').length;
  const reviewCount = papers.filter(p => p.status === 'PENDING_REVIEW').length;
  const finalizedCount = papers.filter(p => p.status === 'FINALIZED').length;
  const officialCount = papers.filter(p => p.status === 'OFFICIAL').length;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="page-title flex items-center gap-2"><FileText size={22} className="text-[var(--fox)]" /> 试卷管理</h1>
          <p className="page-subtitle">
            草稿 {draftCount} · 待审 {reviewCount} · 已定稿 {finalizedCount} · 正式 {officialCount} &mdash; 共 {total} 份试卷
            {totalPages > 1 && <span className="ml-3 text-xs opacity-50">第 {page}/{totalPages} 页</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="sm" icon={<Sparkles size={14} />} onClick={() => router.push('/generate')}>小狐狸，组个卷</Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="搜索名称/编号…" className="input" style={{ maxWidth: 220 }}
          onKeyDown={e => e.key === 'Enter' && load(1)} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }} className="input" style={{ maxWidth: 130 }}>
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PENDING_REVIEW">待审核</option>
          <option value="FINALIZED">已定稿</option>
          <option value="OFFICIAL">正式考卷</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); }} className="input" style={{ maxWidth: 160 }}>
          <option value="">全部科目</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterOrg} onChange={e => { setFilterOrg(e.target.value); }} className="input" style={{ maxWidth: 160 }}>
          <option value="">全部组织</option>
          {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.code} - {o.name}</option>)}
        </select>
        <button onClick={() => load(1)} className="btn btn-outline btn-xs">筛选</button>
        {(keyword || filterStatus || filterSubject || filterOrg) && (
          <button onClick={() => { setKeyword(''); setFilterStatus(''); setFilterSubject(''); setFilterOrg(''); setTimeout(() => load(1), 0); }} className="btn btn-ghost btn-xs text-[var(--verm)]" >清除</button>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg bg-[var(--fox-glow)]" style={{  border: '1px solid var(--fox)' }}>
          <span className="text-[var(--fox-dark)] text-xs font-medium">已选 {selectedIds.length} 套</span>
          <button onClick={() => handleBatchStatus('FINALIZED')} className="btn btn-xs btn-outline">批量定稿</button>
          <button onClick={() => handleBatchStatus('ARCHIVED')} className="btn btn-xs btn-outline">批量归档</button>
          <button onClick={handleBatchDelete} className="btn btn-xs text-[var(--verm)] border-[var(--verm)]" >批量删除</button>
          <button onClick={() => setSelectedIds([])} className="btn btn-xs btn-ghost">取消选择</button>
        </div>
      )}

      {loading ? (
        <SkeletonCardGrid count={6} />
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : papers.length === 0 ? (
        <div className="card">
          <EmptyState icon="" title="还没有试卷" description="让小狐狸帮你组一份试卷">
            <Button size="sm" icon={<Sparkles size={14} />} onClick={() => router.push('/generate')}>让小狐狸组一份</Button>
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {papers.map((p: any) => (
            <div key={p.id} className="card p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--fox)]" style={selectedIds.includes(p.id) ? { borderColor: 'var(--fox)', boxShadow: '0 0 0 2px var(--fox-glow)' } : {}}>
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)}
                    className="mt-1 w-3.5 h-3.5 accent-[var(--fox)] cursor-pointer flex-shrink-0" />
                  <h3 className="text-[var(--ink-800)] font-serif font-bold text-sm leading-snug">{p.name}</h3>
                </div>
                <span className={`tag ${
                  p.status === 'OFFICIAL' ? 'tag-verm' :
                  p.status === 'FINALIZED' ? 'tag-cyan' :
                  p.status === 'PENDING_REVIEW' ? 'tag-gold' :
                  p.status === 'ARCHIVED' ? 'tag-ink' : 'tag-ink'
                }`}>{statusLabel(p.status)}</span>
                {p.orgId && (
                  <span className="tag tag-gold" style={{ fontSize: '10px', padding: '1px 5px', marginLeft: '4px' }}>
                    机构
                  </span>
                )}
              </div>

              <p className="text-[var(--ink-300)] text-xs mb-3">{p.paperNumber}</p>

              <div className="text-[var(--ink-400)] flex flex-wrap gap-x-4 gap-y-1 text-xs mb-4">
                <span>{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>{p.creator?.displayName || '—'}</span>
                <span>{p.totalScore}分 · {p._count?.questions || 0}题</span>
              </div>

              <div className="border-[var(--ink-100)] flex flex-wrap items-center gap-2 pt-4 border-t">
                <button onClick={() => router.push(`/papers/${p.id}`)} className="btn btn-ink btn-xs">查看</button>
                <button onClick={() => handleAnswerSheet(p.id)} className="btn btn-fox btn-xs">答题卡</button>
                <button onClick={() => openAnswer(p)} className="btn btn-outline btn-xs">答案</button>
                <div className="relative">
                  <button onClick={() => setMoreMenu(moreMenu === p.id ? null : p.id)} className="btn btn-ghost btn-xs">⋯ 更多</button>
                  {moreMenu === p.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-36 py-1 rounded-lg shadow-lg border text-xs bg-[var(--paper-bright)] border-[var(--ink-200)]" 
                      onMouseLeave={() => setMoreMenu(null)}>
                      <button onClick={() => { handleDownload(p.id, 'word'); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)]">下载试卷 Word</button>
                      <button onClick={() => { handleDownload(p.id, 'pdf'); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)]">下载 PDF</button>
                      {p.status === 'DRAFT' && (
                        <button onClick={() => { router.push(`/generate?copyFrom=${p.id}`); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)]">修改配置</button>
                      )}
                      {p.status === 'FINALIZED' && (
                        <button onClick={async () => { try { await api.papers.promote(p.id); toast.success('已转为正式'); load(); } catch (e: any) { toast.error('操作失败：' + e.message); } setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)] text-[var(--gold-dark)]" >转为正式</button>
                      )}
                      <button onClick={() => { router.push(`/generate?copyFrom=${p.id}`); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)]">复制组卷</button>
                      {p.status !== 'ARCHIVED' && (
                        <button onClick={() => { handleArchive(p.id); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)] text-[var(--ink-400)]" >归档</button>
                      )}
                      {p.status === 'ARCHIVED' && (
                        <button onClick={() => { handleRestore(p.id); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)] text-[var(--cyan)]" >恢复为草稿</button>
                      )}
                      <hr className="border-[var(--ink-100)] my-1" />
                      <button onClick={() => { setDeleteTarget(p.id); setMoreMenu(null); }} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--paper-light)] text-[var(--verm)]" >删除</button>
                    </div>
                  )}
                </div>
              </div>

              {(p.status === 'FINALIZED' || p.status === 'OFFICIAL') && (
                <div className="border-[var(--ink-100)] mt-3 pt-3 border-t border-dashed">
                  <label className="text-[var(--ink-300)] text-xs">
                    <span className="cursor-pointer hover:text-[var(--gold)] transition-colors">↑ 上传编辑版 Word 生成印刷 PDF</span>
                    <input type="file" accept=".docx" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadWord(f, p.id); }} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      <Pagination page={page} totalPages={totalPages} total={total} onChange={goPage} className="mb-4" />

      {/* Answer Key Modal */}
      {showAnswer && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAnswer(null); }}>
          <div className="modal-card animate-fadeSlide">
            <div className="modal-header">
              <div>
                <h3 className="font-serif font-bold text-base">试卷答案</h3>
                <p className="text-[var(--ink-300)] text-xs mt-1">{showAnswer.name} · {showAnswer.paperNumber}</p>
              </div>
              <span className="tag tag-verm">仅供命题人查阅</span>
            </div>

            <div className="modal-body">
              {(() => {
                const grouped: Record<string, any[]> = {};
                showAnswer.questions?.forEach((pq: any) => {
                  const section = pq.typeSection || 'Other';
                  if (!grouped[section]) grouped[section] = [];
                  grouped[section].push(pq);
                });
                return Object.entries(grouped).map(([section, items]) => (
                  <div key={section} className="mb-4">
                    <h4 className="text-[var(--ink-500)] text-sm font-semibold mb-2">{section}</h4>
                    <div className="space-y-1">
                      {items.map((pq: any, i: number) => {
                        const q = pq.question;
                        let answer = '—';
                        if (q?.type === 'SINGLE_CHOICE') {
                          const correct = q.options?.find((o: any) => o.isCorrect);
                          answer = correct?.label || '—';
                        } else if (q?.type === 'MULTIPLE_CHOICE') {
                          answer = q.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join(', ') || '—';
                        } else if (q?.type === 'TRUE_FALSE') {
                          const correct = q.options?.[0];
                          answer = correct?.isCorrect ? '✓' : '✗';
                        } else if (q?.type === 'FILL_BLANK') {
                          answer = q.blanks?.map((b: any) => b.answer).join(' / ') || '—';
                        } else {
                          answer = '见参考答案详情';
                        }
                        return (
                          <div key={pq.id} className="border-[var(--ink-100)] flex gap-3 text-xs py-1 border-b border-dashed last:border-b-0">
                            <span className="text-[var(--ink-300)]">{i + 1}.</span>
                            <span className="text-[var(--cyan)]">{answer}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowAnswer(null)} className="btn btn-ink btn-sm">关闭</button>
            </div>
          </div>
        </div>
      )}
      <ReasonConfirmModal
        open={deleteTarget !== null}
        title="🗑 删除试卷"
        required
        presetReasons={['创建错误', '试卷已过时', '重复创建']}
        confirmText="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppLayout>
  );
}
