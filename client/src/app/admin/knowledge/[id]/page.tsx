'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function KnowledgeDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const docId = parseInt(params.id as string);

  const [doc, setDoc] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedChunk, setSelectedChunk] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // 重建参数
  const [showRebuild, setShowRebuild] = useState(false);
  const [chunkSize, setChunkSize] = useState(500);
  const [overlap, setOverlap] = useState(50);

  // 知识点选择
  const [showKpPicker, setShowKpPicker] = useState(false);
  const [kpTree, setKpTree] = useState<any[]>([]);
  const [selectedKpIds, setSelectedKpIds] = useState<number[]>([]);

  const loadDoc = async () => {
    try {
      const d = await api.knowledge.getDocument(docId);
      setDoc(d);
    } catch (e: any) { toast.error('加载文档失败'); }
  };

  const loadChunks = async () => {
    setLoading(true);
    try {
      const data = await api.knowledge.getChunks(docId, { page, pageSize: 50 });
      setChunks(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadDoc(); }, [docId]);
  useEffect(() => { loadChunks(); }, [docId, page]);

  const selectChunk = (chunk: any) => {
    setSelectedChunk(chunk);
    setEditContent(chunk.content);
    setSelectedKpIds(chunk.knowledgePoints?.map((kp: any) => kp.knowledgePointId) || []);
  };

  const saveChunk = async () => {
    if (!selectedChunk) return;
    setSaving(true);
    try {
      await api.knowledge.updateChunk(selectedChunk.id, { content: editContent });
      toast.success('已保存');
      loadChunks();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleMerge = async () => {
    if (!selectedChunk) return;
    if (!confirm('将此块与下一块合并？')) return;
    try {
      await api.knowledge.mergeChunk(selectedChunk.id);
      toast.success('合并成功');
      setSelectedChunk(null);
      loadChunks(); loadDoc();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSplit = async () => {
    if (!selectedChunk) return;
    const pos = editContent.length > 100 ? Math.floor(editContent.length / 2) : -1;
    if (pos < 0) { toast.error('内容太短，无法拆分'); return; }
    if (!confirm(`在中间位置（第${pos}字符）拆分？`)) return;
    try {
      await api.knowledge.splitChunk(selectedChunk.id, pos);
      toast.success('拆分成功');
      setSelectedChunk(null);
      loadChunks(); loadDoc();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteChunk = async () => {
    if (!selectedChunk) return;
    if (!confirm('删除此知识块？')) return;
    try {
      await api.knowledge.deleteChunk(selectedChunk.id);
      toast.success('已删除');
      setSelectedChunk(null);
      loadChunks(); loadDoc();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRebuild = async () => {
    if (!confirm(`重新分块将删除所有现有块和知识点标注，确定？`)) return;
    try {
      const res = await api.knowledge.rebuildChunks(docId, { chunkSize, overlap });
      toast.success(`重建完成，生成 ${res.chunks} 个块`);
      setShowRebuild(false);
      setSelectedChunk(null);
      loadChunks(); loadDoc();
    } catch (e: any) { toast.error(e.message); }
  };

  const loadKpTree = async () => {
    if (!doc?.subjectId) return;
    try {
      const tree = await api.knowledgePoints.getTree(doc.subjectId);
      setKpTree(tree || []);
    } catch {}
  };

  const saveKnowledgePoints = async () => {
    if (!selectedChunk) return;
    try {
      await api.knowledge.setChunkKnowledgePoints(selectedChunk.id, selectedKpIds);
      toast.success('知识点关联已更新');
      setShowKpPicker(false);
      loadChunks();
    } catch (e: any) { toast.error(e.message); }
  };

  const flattenTree = (nodes: any[], depth = 0): any[] => {
    const result: any[] = [];
    for (const n of nodes) {
      result.push({ ...n, depth });
      if (n.children?.length) result.push(...flattenTree(n.children, depth + 1));
    }
    return result;
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/admin/knowledge')} className="btn btn-outline btn-sm">← 返回</button>
        <div>
          <h1 className="page-title">{doc?.name || '加载中…'}</h1>
          <p className="page-subtitle">
            {doc?.subject?.name} · {doc?.chunkCount || 0} 个知识块 · v{doc?.version || 1}
            {doc?.status === 'PROCESSING' && ' · ⏳ 处理中'}
            {doc?.status === 'FAILED' && ' · ❌ 处理失败'}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowRebuild(true)} className="btn btn-outline btn-sm">🔄 重新分块</button>
        </div>
      </div>

      <div className="flex gap-5" style={{ minHeight: '60vh' }}>
        {/* 左侧：块列表 */}
        <div className="card p-0 overflow-hidden" style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="p-3 text-xs font-medium" style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-400)' }}>
            知识块列表（{total} 个）
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div className="text-[var(--ink-300)] p-6 text-center text-xs">加载中…</div>
            ) : chunks.map((c: any) => (
              <div key={c.id}
                onClick={() => selectChunk(c)}
                className="p-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: selectedChunk?.id === c.id ? 'var(--fox-bg)' : 'transparent',
                  borderLeft: selectedChunk?.id === c.id ? '3px solid var(--fox)' : '3px solid transparent',
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--fox)] text-xs font-medium">#{c.chunkIndex}</span>
                  <span className="text-[var(--ink-300)] text-xs">{c.content?.length || 0} 字</span>
                </div>
                <p className="text-[var(--ink-500)] text-xs mt-1 line-clamp-2">
                  {(c.content || '').slice(0, 60)}…
                </p>
                {c.knowledgePoints?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.knowledgePoints.slice(0, 3).map((kp: any) => (
                      <span key={kp.id} className="tag" style={{ fontSize: '9px', background: 'var(--success-pale)', color: 'var(--sage)' }}>
                        {kp.knowledgePoint?.name}
                      </span>
                    ))}
                    {c.knowledgePoints.length > 3 && <span className="text-[var(--ink-300)] text-xs">+{c.knowledgePoints.length - 3}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="p-2 flex items-center justify-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-sm">‹</button>
              <span className="text-xs">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-sm">›</button>
            </div>
          )}
        </div>

        {/* 右侧：编辑区 */}
        <div className="card p-5" style={{ flex: 1 }}>
          {selectedChunk ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">编辑知识块 #{selectedChunk.chunkIndex}</span>
                <div className="flex gap-2">
                  <button onClick={() => { loadKpTree(); setShowKpPicker(true); }} className="btn btn-outline btn-sm">🏷️ 知识点</button>
                  <button onClick={handleMerge} className="btn btn-outline btn-sm">⬆️ 合并</button>
                  <button onClick={handleSplit} className="btn btn-outline btn-sm">✂️ 拆分</button>
                  <button onClick={handleDeleteChunk} className="text-[var(--error)] btn btn-outline btn-sm">🗑️</button>
                </div>
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="input"
                style={{ flex: 1, minHeight: 300, resize: 'none', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6 }}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[var(--ink-300)] text-xs">{editContent.length} 字符</span>
                <button onClick={saveChunk} disabled={saving} className="btn btn-fox btn-sm">
                  {saving ? '保存中…' : '💾 保存修改'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[var(--ink-300)]">← 选择一个知识块进行编辑</p>
            </div>
          )}
        </div>
      </div>

      {/* 重新分块弹窗 */}
      {showRebuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="card p-6" style={{ width: 380 }}>
            <h3 className="text-base font-semibold mb-4">🔄 重新分块</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--ink-400)] text-xs">块大小（字符数）</label>
                <input type="number" value={chunkSize} onChange={e => setChunkSize(parseInt(e.target.value) || 500)}
                  className="input mt-1 w-full" min={100} max={2000} />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs">重叠字符数</label>
                <input type="number" value={overlap} onChange={e => setOverlap(parseInt(e.target.value) || 50)}
                  className="input mt-1 w-full" min={0} max={200} />
              </div>
              <p className="text-[var(--error)] text-xs">⚠️ 重新分块将删除所有现有块及知识点标注</p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowRebuild(false)} className="btn btn-outline btn-sm">取消</button>
              <button onClick={handleRebuild} className="btn btn-fox btn-sm">确认重建</button>
            </div>
          </div>
        </div>
      )}

      {/* 知识点选择弹窗 */}
      {showKpPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="card p-6" style={{ width: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-base font-semibold mb-3">🏷️ 关联知识点</h3>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
              {kpTree.length === 0 ? (
                <p className="text-[var(--ink-300)] text-sm text-center py-8">该科目暂无知识点</p>
              ) : (
                flattenTree(kpTree).map((kp: any) => (
                  <label key={kp.id} className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-[var(--paper-light)]"
                    style={{ paddingLeft: kp.depth * 20 + 8 }}>
                    <input type="checkbox" checked={selectedKpIds.includes(kp.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedKpIds(prev => [...prev, kp.id]);
                        else setSelectedKpIds(prev => prev.filter(id => id !== kp.id));
                      }} />
                    <span className="text-sm">{kp.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowKpPicker(false)} className="btn btn-outline btn-sm">取消</button>
              <button onClick={saveKnowledgePoints} className="btn btn-fox btn-sm">保存关联</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
