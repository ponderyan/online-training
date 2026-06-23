'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function PapersPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState<any>(null);
  const [keyword, setKeyword] = useState('');
  const [paginationInfo, setPaginationInfo] = useState<any>(null);

  const load = async (p: number = page) => {
    setLoading(true);
    try {
      const data = await api.papers.list(p);
      let items = data.items || [];
      if (keyword) items = items.filter((i: any) => i.name?.includes(keyword) || i.paperNumber?.includes(keyword));
      setPapers(items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setPaginationInfo(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const goPage = (p: number) => { if (p >= 1 && p <= totalPages) load(p); };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'OFFICIAL': return '正式考卷';
      case 'FINALIZED': return '已定稿';
      default: return '草稿';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此试卷？')) return;
    await api.papers.delete(id);
    load();
  };

  const openAnswer = async (p: any) => {
    try { const full = await api.papers.get(p.id); setShowAnswer(full); }
    catch { setShowAnswer(p); }
  };

  const handleDownload = (paperId: number, format: 'word' | 'pdf') => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-${format}`;
    a.click();
  };

  const handleAnswerSheet = (paperId: number) => {
    const a = document.createElement('a');
    a.href = `/api/papers/${paperId}/export-answer-sheet`;
    a.download = `answer-sheet-${paperId}.docx`;
    a.click();
  };

  const handleUploadWord = async (file: File, paperId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/papers/${paperId}/upload-word`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('上传失败');
      alert('Word 上传成功，PDF 已生成');
    } catch (e: any) {
      alert('上传失败：' + e.message);
    }
  };

  const draftCount = papers.filter(p => p.status === 'DRAFT').length;
  const finalizedCount = papers.filter(p => p.status === 'FINALIZED').length;
  const officialCount = papers.filter(p => p.status === 'OFFICIAL').length;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-7">
      <input value={keyword} onChange={e => setKeyword(e.target.value)}
        placeholder="🔍 搜索试卷名称/编号…" className="input" style={{ maxWidth: 320 }}
        onKeyDown={e => e.key === 'Enter' && load()} />

        <div>
          <h1 className="page-title">🦊 试卷管理</h1>
          <p className="page-subtitle">
            草稿 {draftCount} · 已定稿 {finalizedCount} · 正式 {officialCount} &mdash; 共 {total} 份试卷
            {totalPages > 1 && <span className="ml-3 text-xs opacity-50">第 {page}/{totalPages} 页</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/generate')} className="btn btn-fox btn-sm">+ 小狐狸，组个卷</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : papers.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>
          <p className="mb-3">小狐狸还没找到试卷呢 🦊</p>
          <button onClick={() => router.push('/generate')} className="btn btn-fox btn-sm">让小狐狸组一份</button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {papers.map((p: any) => (
            <div key={p.id} className="card p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--fox)]">
              <div className="flex justify-between items-start gap-3 mb-3">
                <h3 className="font-serif font-bold text-sm leading-snug" style={{ color: 'var(--ink-800)' }}>{p.name}</h3>
                <span className={`tag ${
                  p.status === 'OFFICIAL' ? 'tag-verm' :
                  p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                }`}>{statusLabel(p.status)}</span>
              </div>

              <p className="text-xs mb-3" style={{ color: 'var(--ink-300)' }}>{p.paperNumber}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-4" style={{ color: 'var(--ink-400)' }}>
                <span>{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>{p.creator?.displayName || '—'}</span>
                <span>{p.totalScore}分 · {p._count?.questions || 0}题</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <button onClick={() => router.push(`/papers/${p.id}`)} className="btn btn-ink btn-xs">查看</button>
                {p.status === 'DRAFT' && (
                  <button onClick={() => router.push(`/generate?copyFrom=${p.id}`)} className="btn btn-outline btn-xs">修改配置</button>
                )}
                <button onClick={() => openAnswer(p)} className="btn btn-outline btn-xs">答案</button>
                <button onClick={() => handleDownload(p.id, 'word')} className="btn btn-outline btn-xs">试卷</button>
                <button onClick={() => handleAnswerSheet(p.id)} className="btn btn-fox btn-xs">答题卡</button>
                <button onClick={() => handleDownload(p.id, 'pdf')} className="btn btn-outline btn-xs">PDF</button>
                {p.status === 'FINALIZED' && (
                  <button onClick={() => { api.papers.promote(p.id); load(); }} className="btn btn-outline btn-xs" style={{ color: 'var(--gold-dark)' }}>转为正式</button>
                )}
                <button onClick={() => router.push(`/generate?copyFrom=${p.id}`)} className="btn btn-ghost btn-xs">复制</button>
                <button onClick={() => handleDelete(p.id)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
              </div>

              {(p.status === 'FINALIZED' || p.status === 'OFFICIAL') && (
                <div className="mt-3 pt-3 border-t border-dashed" style={{ borderColor: 'var(--ink-100)' }}>
                  <label className="text-xs" style={{ color: 'var(--ink-300)' }}>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 mb-4">
          <button onClick={() => goPage(page - 1)} disabled={page <= 1}
            className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>
            ‹ 上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="mx-1 text-xs" style={{ color: 'var(--ink-300)' }}>…</span>}
                <button onClick={() => goPage(p)}
                  className={`btn btn-xs ${p === page ? 'btn-fox' : 'btn-ghost'}`}
                  style={p === page ? {} : {}}>
                  {p}
                </button>
              </span>
            ))}
          <button onClick={() => goPage(page + 1)} disabled={page >= totalPages}
            className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>
            下一页 ›
          </button>
        </div>
      )}

      {/* Answer Key Modal */}
      {showAnswer && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAnswer(null); }}>
          <div className="modal-card animate-fadeSlide">
            <div className="modal-header">
              <div>
                <h3 className="font-serif font-bold text-base">试卷答案</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>{showAnswer.name} · {showAnswer.paperNumber}</p>
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
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink-500)' }}>{section}</h4>
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
                          <div key={pq.id} className="flex gap-3 text-xs py-1 border-b border-dashed last:border-b-0" style={{ borderColor: 'var(--ink-100)' }}>
                            <span style={{ color: 'var(--ink-300)' }}>{i + 1}.</span>
                            <span style={{ color: 'var(--cyan)' }}>{answer}</span>
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
    </AppLayout>
  );
}
