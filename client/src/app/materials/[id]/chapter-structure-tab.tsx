'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  STRUCTURED: '已结构化',
  GENERATING: '出题中',
  GENERATED: '已出题',
};

interface Chapter {
  id: number;
  title: string;
  content: string | null;
  contentLength: number;
  status: string;
  questionCount: number;
  sortOrder: number;
}

export default function ChapterStructureTab({
  materialId,
  chapters,
  onConfirm,
}: {
  materialId: number;
  chapters: Chapter[];
  onConfirm: () => void;
}) {
  const [loadingChapter, setLoadingChapter] = useState<number | null>(null);
  const [expandedContent, setExpandedContent] = useState<Record<number, { text: string; loading: boolean }>>({});
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [splitChapterId, setSplitChapterId] = useState<number | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const isLocked = chapters.some(c => c.status === 'STRUCTURED');

  // ── 展开/折叠章节正文 ──
  const toggleExpand = async (ch: Chapter) => {
    if (expandedContent[ch.id]) {
      const next = { ...expandedContent };
      delete next[ch.id];
      setExpandedContent(next);
      return;
    }
    setExpandedContent(prev => ({ ...prev, [ch.id]: { text: '', loading: true } }));
    try {
      const data = await api.materials.getChapterContent(materialId, ch.id);
      setExpandedContent(prev => ({ ...prev, [ch.id]: { text: data.content || '(空)', loading: false } }));
    } catch {
      setExpandedContent(prev => ({ ...prev, [ch.id]: { text: '⚠ 加载失败', loading: false } }));
    }
  };

  // ── 编辑标题 ──
  const startEditTitle = (ch: Chapter) => {
    if (isLocked) return;
    setEditingTitle(ch.id);
    setEditTitleValue(ch.title);
  };
  const saveTitle = async (chId: number) => {
    if (!editTitleValue.trim()) return;
    setLoadingChapter(chId);
    try {
      await api.materials.updateChapter(materialId, chId, { title: editTitleValue.trim() });
      setEditingTitle(null);
      onConfirm();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setLoadingChapter(null);
  };

  // ── 删除章节 ──
  const handleDelete = async (chId: number) => {
    if (isLocked) return;
    if (!confirm('确认删除此章节？关联的试题也将被删除。')) return;
    setLoadingChapter(chId);
    try {
      await api.materials.deleteChapter(materialId, chId);
      onConfirm();
    } catch (e: any) { alert('删除失败：' + e.message); }
    setLoadingChapter(null);
  };

  // ── 合并章节 ──
  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    const ids = [...selectedIds].sort((a, b) => {
      const ca = chapters.find(c => c.id === a);
      const cb = chapters.find(c => c.id === b);
      return (ca?.sortOrder || 0) - (cb?.sortOrder || 0);
    });
    if (!confirm(`确认合并选中的 ${ids.length} 个章节？合并后内容将拼接到第一个章节。`)) return;
    setLoadingChapter(-1);
    try {
      await api.materials.mergeChapters(materialId, { chapterIds: ids });
      setSelectedIds(new Set());
      onConfirm();
    } catch (e: any) { alert('合并失败：' + e.message); }
    setLoadingChapter(null);
  };

  // ── 分割章节 ──
  const handleSplit = async () => {
    if (!splitChapterId || splitPosition <= 0) return;
    if (!confirm(`确认在此章节的第 ${splitPosition} 字符处分割？`)) return;
    setLoadingChapter(-1);
    try {
      await api.materials.splitChapter(materialId, { chapterId: splitChapterId, splitPosition });
      setSplitChapterId(null);
      setSplitPosition(0);
      onConfirm();
    } catch (e: any) { alert('分割失败：' + e.message); }
    setLoadingChapter(null);
  };

  // ── 确认结构化 ──
  const handleConfirm = async () => {
    if (!confirm('确认章节结构已完成？确认后将锁定章节编辑，进入出题配置阶段。')) return;
    setConfirming(true);
    try {
      await api.materials.confirmStructure(materialId);
      onConfirm();
    } catch (e: any) { alert('确认失败：' + e.message); }
    setConfirming(false);
  };

  // ── 勾选合并 ──
  const toggleSelect = (id: number) => {
    if (isLocked) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  if (chapters.length === 0) {
    return (
      <div className="card p-10 text-center" style={{ color: 'var(--ink-300)' }}>
        📭 暂无章节，请先上传教材或录入正文
      </div>
    );
  }

  return (
    <div>
      {/* 章节列表 */}
      <div className="space-y-2 mb-5">
        {chapters.map((ch, idx) => (
          <div key={ch.id} className="card p-4 transition-all">
            {/* 章节行 */}
            <div className="flex items-center gap-3">
              {/* 合并复选框 */}
              {!isLocked && (
                <span onClick={() => toggleSelect(ch.id)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${selectedIds.has(ch.id) ? '' : ''}`}
                  style={{
                    borderColor: selectedIds.has(ch.id) ? 'var(--fox)' : 'var(--ink-200)',
                    background: selectedIds.has(ch.id) ? 'var(--fox)' : 'transparent',
                  }}>
                  {selectedIds.has(ch.id) && <span className="text-white text-[10px]">✓</span>}
                </span>
              )}

              {/* 序号 */}
              <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--ink-300)' }}>{idx + 1}.</span>

              {/* 标题（编辑模式/显示模式） */}
              {editingTitle === ch.id ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input value={editTitleValue} onChange={e => setEditTitleValue(e.target.value)}
                    className="input text-sm flex-1" autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTitle(ch.id);
                      if (e.key === 'Escape') setEditingTitle(null);
                    }} />
                  <button onClick={() => saveTitle(ch.id)} className="btn btn-fox btn-xs">保存</button>
                  <button onClick={() => setEditingTitle(null)} className="btn btn-ghost btn-xs">取消</button>
                </div>
              ) : (
                <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--ink-700)' }}>
                  {ch.contentLength > 0 ? '📄' : '📄'} {ch.title}
                </span>
              )}

              {/* 字数 */}
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-300)' }}>
                {ch.contentLength > 0 ? `${(ch.contentLength / 1000).toFixed(1)}k 字` : '—'}
              </span>

              {/* 状态 */}
              <span className={`tag flex-shrink-0 ${ch.status === 'STRUCTURED' ? 'tag-cyan' : 'tag-ink'}`}>
                {STATUS_LABELS[ch.status] || ch.status}
              </span>

              {/* 操作按钮 */}
              {!isLocked && (
                <>
                  <button onClick={() => startEditTitle(ch)}
                    className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--fox)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>编辑</button>
                  <button onClick={() => handleDelete(ch.id)}
                    className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                </>
              )}

              {/* 展开/折叠 */}
              <button onClick={() => toggleExpand(ch)}
                className="btn btn-ghost btn-xs" style={{ color: 'var(--fox)' }}>
                {expandedContent[ch.id] ? '收起' : '展开'}
              </button>
            </div>

            {/* 展开的正文 */}
            {expandedContent[ch.id] && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                {expandedContent[ch.id].loading ? (
                  <p className="text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</p>
                ) : (
                  <div>
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto p-3 rounded"
                      style={{ background: 'var(--paper)', color: 'var(--ink-600)' }}>
                      {expandedContent[ch.id].text}
                    </pre>
                    {/* 分割操作 */}
                    {!isLocked && splitChapterId === ch.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs" style={{ color: 'var(--ink-400)' }}>在此位置分割：</span>
                        <input type="number" value={splitPosition}
                          onChange={e => setSplitPosition(Math.min(Number(e.target.value), (ch.content || '').length))}
                          className="input text-xs" style={{ width: '100px' }}
                          placeholder={`0-${ch.content?.length || 0}`} />
                        <button onClick={handleSplit} className="btn btn-fox btn-xs">确认分割</button>
                        <button onClick={() => { setSplitChapterId(null); setSplitPosition(0); }}
                          className="btn btn-ghost btn-xs">取消</button>
                      </div>
                    ) : !isLocked && (
                      <button onClick={() => { setSplitChapterId(ch.id); setSplitPosition(Math.floor((ch.content?.length || 0) / 2)); }}
                        className="btn btn-ghost btn-xs mt-2" style={{ color: 'var(--fox)' }}>
                        在此分割 ➔
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 操作栏 */}
      {!isLocked && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 合并按钮 */}
            <button onClick={handleMerge} disabled={selectedIds.size < 2}
              className="btn btn-outline btn-sm"
              style={{ opacity: selectedIds.size < 2 ? 0.4 : 1 }}>
              🔗 合并选中章节 ({selectedIds.size})
            </button>

            <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
              勾选≥2个相邻章节可合并
            </span>
          </div>
        </div>
      )}

      {/* 确认结构化 */}
      {!isLocked && (
        <div className="text-center py-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-400)' }}>
            确认章节结构后，章节将锁定不可编辑，并进入「出题配置」阶段
          </p>
          <button onClick={handleConfirm} disabled={confirming}
            className="btn btn-fox">
            {confirming ? '确认中…' : '✅ 确认章节结构'}
          </button>
        </div>
      )}
    </div>
  );
}
