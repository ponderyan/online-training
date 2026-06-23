'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.knowledge.listDocuments({ pageSize: 100, search: search || undefined });
      setDocuments(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [search]);

  const doSearch = () => { setSearch(searchInput); };

  const handleDelete = async (source: string) => {
    if (!confirm(`确定删除「${source}」的所有知识块吗？`)) return;
    try { await api.knowledge.deleteDocument(source); load(); }
    catch (e: any) { alert('删除失败：' + e.message); }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">📚 知识库管理</h1>
          <p className="page-subtitle">管理教材知识文档 · 共 {total} 个文档</p>
        </div>
        <button onClick={() => alert('知识文档上传功能开发中')} className="btn btn-fox btn-sm">➕ 上传文档</button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex gap-2">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="🔍 搜索文件名…" className="input" style={{ maxWidth: 240 }} />
          <button onClick={doSearch} className="btn btn-outline btn-sm">搜索</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div>
      ) : documents.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📚</p>
          <p style={{ color: 'var(--ink-300)' }}>暂无知识文档</p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>通过教材出题功能上传教材后，知识块将自动生成</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="list-table">
            <thead><tr>
              <th>来源文件名</th><th>关联科目</th><th>知识块数</th><th>上传时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              {documents.map((d: any) => (
                <tr key={d.source}>
                  <td className="font-medium text-sm">{d.source}</td>
                  <td style={{ color: 'var(--ink-400)' }} className="text-xs">{d.subjectName || '—'}</td>
                  <td><span className="tag" style={{ background: '#7b1fa218', color: '#7b1fa2', fontSize: '10px' }}>{d.chunkCount} 块</span></td>
                  <td className="text-xs" style={{ color: 'var(--ink-300)' }}>{d.createdAt ? new Date(d.createdAt).toLocaleString('zh-CN') : '—'}</td>
                  <td>
                    <button onClick={() => handleDelete(d.source)} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: '#e53935' }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
