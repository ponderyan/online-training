'use client';

import { useEffect, useState, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

type Tab = 'documents' | 'search';

export default function KnowledgePage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('documents');
  const [documents, setDocuments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  // 上传相关
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSubjectId, setUploadSubjectId] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 检索测试
  const [testQuery, setTestQuery] = useState('');
  const [testSubjectId, setTestSubjectId] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testKeywords, setTestKeywords] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.knowledge.listDocuments({ pageSize: 100, search: search || undefined });
      setDocuments(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  const loadSubjects = async () => {
    try {
      const data = await api.subjects.listActive();
      setSubjects(Array.isArray(data) ? data : (data as any).items || []);
    } catch {}
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => { loadSubjects(); }, []);

  const doSearch = () => setSearch(searchInput);

  const handleUpload = async (file: File) => {
    if (!uploadSubjectId) { toast.error('请选择关联科目'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subjectId', uploadSubjectId);
      if (uploadName.trim()) fd.append('name', uploadName.trim());
      await api.knowledge.uploadDocument(fd);
      toast.success('上传成功，正在处理分块…');
      setShowUpload(false);
      setUploadName('');
      load();
      // 轮询状态
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error('上传失败：' + (e.message || '未知错误'));
    }
    setUploading(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除「${name}」及其所有知识块吗？`)) return;
    try { await api.knowledge.deleteDocument(id); toast.success('已删除'); load(); }
    catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  const handleTestQuery = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    try {
      const data = await api.knowledge.testQuery(testQuery, testSubjectId ? parseInt(testSubjectId) : undefined);
      setTestResults(data.results || []);
      setTestKeywords(data.keywords || []);
    } catch (e: any) { toast.error('检索失败：' + e.message); }
    setTesting(false);
  };

  const highlightKeywords = (text: string, keywords: string[]) => {
    if (!keywords.length) return text;
    let result = text;
    for (const kw of keywords) {
      result = result.replace(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'), '<mark>$1</mark>');
    }
    return result;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      READY: { label: '就绪', color: 'var(--sage-light)' },
      PROCESSING: { label: '处理中', color: 'var(--fox-light)' },
      FAILED: { label: '失败', color: 'var(--error)' },
    };
    const s = map[status] || { label: status, color: 'var(--neutral-400)' };
    return <span className="tag" style={{ background: s.color + '18', color: s.color, fontSize: '10px' }}>{s.label}</span>;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📚 知识库管理</h1>
          <p className="page-subtitle">管理教材知识文档 · 共 {total} 个文档</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn btn-fox btn-sm">➕ 上传文档</button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {([['documents', '📄 文档管理'], ['search', '🔍 检索测试']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm bg-transparent border-none cursor-pointer"
            style={{ borderBottom: tab === t ? '2px solid var(--fox)' : '2px solid transparent', color: tab === t ? 'var(--fox)' : 'var(--ink-400)', fontWeight: tab === t ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'documents' && (
        <>
          <div className="flex gap-3 mb-5">
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="🔍 搜索文档名…" className="input" style={{ maxWidth: 240 }} />
            <button onClick={doSearch} className="btn btn-outline btn-sm">搜索</button>
          </div>

          {loading ? (
            <div className="text-[var(--ink-300)] text-center py-16">加载中… 🦊</div>
          ) : documents.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-4">📚</p>
              <p className="text-[var(--ink-300)]">暂无知识文档</p>
              <p className="text-[var(--ink-300)] text-xs mt-2">点击「上传文档」添加教材，系统将自动分块建立知识库</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="list-table">
                <thead><tr>
                  <th>文档名称</th><th>关联科目</th><th>知识块</th><th>版本</th><th>状态</th><th>上传时间</th><th>操作</th>
                </tr></thead>
                <tbody>
                  {documents.map((d: any) => (
                    <tr key={d.id}>
                      <td className="font-medium text-sm">
                        <Link href={`/admin/knowledge/${d.id}`} style={{ color: 'var(--fox)', textDecoration: 'none' }}>
                          {d.name}
                        </Link>
                        <span className="text-[var(--ink-300)] text-xs ml-2">.{d.fileType}</span>
                      </td>
                      <td className="text-[var(--ink-400)] text-xs">{d.subject?.name || '—'}</td>
                      <td><span className="tag" style={{ background: 'rgba(123,31,162,0.09)', color: 'var(--purple)', fontSize: '10px' }}>{d.chunkCount} 块</span></td>
                      <td className="text-[var(--ink-300)] text-xs">v{d.version}</td>
                      <td>{statusBadge(d.status)}</td>
                      <td className="text-[var(--ink-300)] text-xs">{d.createdAt ? new Date(d.createdAt).toLocaleString('zh-CN') : '—'}</td>
                      <td className="flex gap-2">
                        <Link href={`/admin/knowledge/${d.id}`} className="text-[var(--fox)] text-xs">分块</Link>
                        <button onClick={() => handleDelete(d.id, d.name)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--error)' }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'search' && (
        <div>
          <div className="card p-5 mb-5">
            <p className="text-sm font-medium mb-3">🔍 检索测试 — 验证学员提问能否命中知识块</p>
            <div className="flex gap-3 flex-wrap">
              <input value={testQuery} onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
                placeholder="输入学员可能的问题，如：什么是安全生产法？" className="input" style={{ flex: 1, minWidth: 250 }} />
              <select value={testSubjectId} onChange={e => setTestSubjectId(e.target.value)} className="input" style={{ maxWidth: 150 }}>
                <option value="">全部科目</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleTestQuery} disabled={testing} className="btn btn-fox btn-sm">
                {testing ? '检索中…' : '检索'}
              </button>
            </div>
            {testKeywords.length > 0 && (
              <div className="flex gap-1 mt-3 flex-wrap">
                <span className="text-[var(--ink-300)] text-xs">提取关键词：</span>
                {testKeywords.map((kw, i) => (
                  <span key={i} className="tag" style={{ fontSize: '10px', background: 'var(--blue-pale)', color: 'var(--blue)' }}>{kw}</span>
                ))}
              </div>
            )}
          </div>

          {testResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[var(--ink-300)] text-xs">命中 {testResults.length} 个知识块</p>
              {testResults.map((r: any, i: number) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[var(--fox)] text-xs font-medium">#{i + 1} {r.documentName || r.title}</span>
                    <span className="text-[var(--ink-300)] text-xs">块 #{r.chunkIndex}</span>
                  </div>
                  <p className="text-[var(--ink-600)] text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: highlightKeywords((r.content || '').slice(0, 300), r.matchedKeywords || []) }} />
                  {r.matchedKeywords?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {r.matchedKeywords.map((kw: string, j: number) => (
                        <span key={j} className="tag" style={{ fontSize: '9px', background: 'var(--fox-pale)', color: 'var(--fox-dark)' }}>{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : testKeywords.length > 0 && !testing ? (
            <div className="card p-8 text-center">
              <p className="text-[var(--ink-300)]">未命中任何知识块 😅</p>
              <p className="text-[var(--ink-300)] text-xs mt-2">尝试上传相关教材或调整问法</p>
            </div>
          ) : null}
        </div>
      )}

      {/* 上传弹窗 */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="card p-6" style={{ width: 440, maxHeight: '80vh', overflow: 'auto' }}>
            <h3 className="text-base font-semibold mb-4">📤 上传知识文档</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[var(--ink-400)] text-xs font-medium">关联科目 *</label>
                <select value={uploadSubjectId} onChange={e => setUploadSubjectId(e.target.value)} className="input mt-1 w-full">
                  <option value="">请选择科目</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs font-medium">文档名称（可选，默认取文件名）</label>
                <input value={uploadName} onChange={e => setUploadName(e.target.value)} className="input mt-1 w-full" placeholder="如：安全生产法教程" />
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: dragOver ? 'var(--fox)' : 'var(--border)', background: dragOver ? 'var(--fox-bg)' : 'transparent' }}>
                <p className="text-2xl mb-2">📄</p>
                <p className="text-[var(--ink-400)] text-sm">拖拽文件到此处，或点击选择</p>
                <p className="text-[var(--ink-300)] text-xs mt-1">支持 PDF / TXT / MD / DOCX，最大 100MB</p>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </div>
              {uploading && <p className="text-[var(--fox)] text-sm text-center">⏳ 上传中…</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowUpload(false)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
