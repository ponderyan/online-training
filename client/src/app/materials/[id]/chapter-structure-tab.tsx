'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
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
  // ★ 2026-08-22 A1：正文编辑状态（修正 OCR 错误/噪声）
  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editContentValue, setEditContentValue] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  // ★ 2026-08-22 A2/A3：大章再分章 / 碎片清理 / 目录分章 的忙碌态（-2 表示整材级操作）
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [splitChapterId, setSplitChapterId] = useState<number | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const isLocked = chapters.some(c => c.status === 'STRUCTURED');
  // ★ 2026-08-22 A2：contentLength 存的是字节数，中文 1 字≈ 3 字节：>2万字 ≈ >60000 字节；碎片章 <200字 ≈ <600 字节且>0（排除空章）
  const BIG_CHAPTER_BYTES = 60000;
  const FRAGMENT_BYTES = 600;
  const fragmentChapters = chapters.filter(c => c.contentLength > 0 && c.contentLength < FRAGMENT_BYTES);
  const bigChapters = chapters.filter(c => c.contentLength > BIG_CHAPTER_BYTES);

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
    } catch (e: any) { toast.error('保存失败：' + e.message); }
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
    } catch (e: any) { toast.error('删除失败：' + e.message); }
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
    } catch (e: any) { toast.error('合并失败：' + e.message); }
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
    } catch (e: any) { toast.error('分割失败：' + e.message); }
    setLoadingChapter(null);
  };

  // ── 确认结构化 ──
  const handleConfirm = async () => {
    if (!confirm('确认章节结构已完成？确认后将锁定章节编辑，进入出题配置阶段。')) return;
    setConfirming(true);
    try {
      await api.materials.confirmStructure(materialId);
      onConfirm();
    } catch (e: any) { toast.error('确认失败：' + e.message); }
    setConfirming(false);
  };

  // ── ★ 2026-08-22 A1：编辑章节正文 ──
  const startEditContent = async (ch: Chapter) => {
    if (isLocked) return;
    setSavingContent(true);
    try {
      // 展开缓存里已有则直接用，否则拉取全文（正文可能很大，展开时才加载过）
      const cached = expandedContent[ch.id];
      const text = cached && !cached.loading && cached.text !== '(空)' && cached.text !== '⚠ 加载失败'
        ? cached.text
        : ((await api.materials.getChapterContent(materialId, ch.id)).content || '');
      setEditContentValue(text);
      setEditingContentId(ch.id);
    } catch (e: any) { toast.error('加载正文失败：' + e.message); }
    setSavingContent(false);
  };
  const saveContent = async (ch: Chapter) => {
    if (editingContentId === null) return;
    setSavingContent(true);
    try {
      await api.materials.updateChapter(materialId, editingContentId, { title: ch.title, content: editContentValue });
      setEditingContentId(null);
      // 同步展开区缓存，避免再次拉取
      setExpandedContent(prev => ({ ...prev, [editingContentId]: { text: editContentValue || '(空)', loading: false } }));
      toast.success('正文已保存，知识块将自动重建');
      onConfirm();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSavingContent(false);
  };

  // ── ★ 2026-08-22 A2：大章 AI 再分章 ──
  const handleAiResplit = async (ch: Chapter) => {
    if (!confirm(`将用 AI 对「${ch.title}」（约 ${(ch.contentLength / 3000).toFixed(0)}k 字）重新分章，原章节会被替换。继续？`)) return;
    setBusyAction(`resplit-${ch.id}`);
    try {
      const r = await api.materials.aiResplitChapter(materialId, ch.id);
      toast.success(`AI 分章完成：拆为 ${r.splitInto} 章`);
      onConfirm();
    } catch (e: any) { toast.error('AI 分章失败：' + e.message); }
    setBusyAction(null);
  };

  // ── ★ 2026-08-22 A2：碎片章清理 ──
  const handleCleanFragments = async () => {
    if (!confirm(`发现 ${fragmentChapters.length} 个碎片章（<200字），将合并进相邻章节。继续？`)) return;
    setBusyAction('clean-fragments');
    try {
      const r = await api.materials.cleanFragmentChapters(materialId);
      toast.success(`已合并 ${r.merged} 个碎片章，剩余 ${r.chapters} 章`);
      onConfirm();
    } catch (e: any) { toast.error('清理失败：' + e.message); }
    setBusyAction(null);
  };

  // ── ★ 2026-08-22 A3：目录驱动分章 ──
  const handleSplitByToc = async () => {
    if (!confirm('将用 AI 提取教材目录并按目录条目重新切分全部章节（现有草稿题的章节归属会清空）。继续？')) return;
    setBusyAction('split-by-toc');
    try {
      const r = await api.materials.splitByToc(materialId);
      toast.success(`目录分章完成：提取 ${r.tocEntries} 条目录，匹配 ${r.matched} 条，共 ${r.chapters} 章`);
      setExpandedContent({});
      onConfirm();
    } catch (e: any) { toast.error('目录分章失败：' + e.message); }
    setBusyAction(null);
  };

  // ── ★ 2026-08-22：解锁结构（确认后反悔的出口） ──
  const handleReopen = async () => {
    if (!confirm('解锁后章节回到可编辑状态，可重新分章/修改后再确认。继续？')) return;
    setBusyAction('reopen');
    try {
      await api.materials.reopenStructure(materialId);
      toast.success('结构已解锁，可重新整理章节');
      onConfirm();
    } catch (e: any) { toast.error('解锁失败：' + e.message); }
    setBusyAction(null);
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
      <div className="text-[var(--ink-300)] card p-10 text-center">
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
              <span className="text-[var(--ink-300)] font-mono text-xs flex-shrink-0">{idx + 1}.</span>

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
                <span className="text-[var(--ink-700)] text-sm font-medium flex-1 min-w-0 truncate">
                  {ch.contentLength > 0 ? '📄' : '📄'} {ch.title}
                </span>
              )}

              {/* 字数 */}
              <span className="text-[var(--ink-300)] text-xs flex-shrink-0">
                {ch.contentLength > 0 ? `${(ch.contentLength / 1000).toFixed(1)}k 字` : '—'}
              </span>

              {/* ★ 2026-08-22 A2：大章/碎片章标记 */}
              {ch.contentLength > BIG_CHAPTER_BYTES && (
                <span className="tag tag-ink flex-shrink-0" title="章节过大，建议 AI 再分章">⚠ 过大</span>
              )}
              {ch.contentLength > 0 && ch.contentLength < FRAGMENT_BYTES && (
                <span className="tag tag-ink flex-shrink-0" title="碎片章节（<200字），建议合并进相邻章">碎片</span>
              )}

              {/* 状态 */}
              <span className={`tag flex-shrink-0 ${ch.status === 'STRUCTURED' ? 'tag-cyan' : 'tag-ink'}`}>
                {STATUS_LABELS[ch.status] || ch.status}
              </span>

              {/* 操作按钮 */}
              {!isLocked && (
                <>
                  <button onClick={() => startEditTitle(ch)}
                    className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--fox)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>编辑</button>
                  {/* ★ 2026-08-22 A2：大章一键 AI 再分章 */}
                  {ch.contentLength > BIG_CHAPTER_BYTES && (
                    <button onClick={() => handleAiResplit(ch)} disabled={busyAction !== null}
                      className="btn btn-ghost btn-xs text-[var(--gold)]">
                      {busyAction === `resplit-${ch.id}` ? 'AI 分章中…' : '🤖 AI再分章'}
                    </button>
                  )}
                  <button onClick={() => handleDelete(ch.id)}
                    className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
                </>
              )}

              {/* 展开/折叠 */}
              <button onClick={() => toggleExpand(ch)}
                className="btn btn-ghost btn-xs text-[var(--fox)]" >
                {expandedContent[ch.id] ? '收起' : '展开'}
              </button>
            </div>

            {/* 展开的正文 */}
            {expandedContent[ch.id] && (
              <div className="border-[var(--ink-100)] mt-3 pt-3 border-t">
                {expandedContent[ch.id].loading ? (
                  <p className="text-[var(--ink-300)] text-xs">加载中…</p>
                ) : editingContentId === ch.id ? (
                  /* ★ 2026-08-22 A1：正文编辑大文本框 */
                  <div>
                    <textarea value={editContentValue} onChange={e => setEditContentValue(e.target.value)}
                      className="input text-xs leading-relaxed w-full font-mono"
                      style={{ minHeight: '280px', maxHeight: '60vh', resize: 'vertical' }} />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => saveContent(ch)} disabled={savingContent} className="btn btn-fox btn-xs">
                        {savingContent ? '保存中…' : '💾 保存正文'}
                      </button>
                      <button onClick={() => setEditingContentId(null)} disabled={savingContent} className="btn btn-ghost btn-xs">取消</button>
                      <span className="text-[var(--ink-300)] text-xs">{editContentValue.length} 字 · 保存后知识块自动重建</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto p-3 rounded bg-[var(--paper)] text-[var(--ink-600)]"
                      >
                      {expandedContent[ch.id].text}
                    </pre>
                    {/* ★ 2026-08-22 A1：编辑正文入口 */}
                    {!isLocked && (
                      <button onClick={() => startEditContent(ch)} disabled={savingContent || busyAction !== null}
                        className="btn btn-ghost btn-xs mt-2 text-[var(--ink-300)]"
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--fox)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>
                        ✏️ 编辑正文（修正OCR错误）
                      </button>
                    )}
                    {/* 分割操作 */}
                    {!isLocked && splitChapterId === ch.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[var(--ink-400)] text-xs">在此位置分割：</span>
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
                        className="btn btn-ghost btn-xs mt-2 text-[var(--fox)]" >
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

            {/* ★ 2026-08-22 A2：碎片章一键清理 */}
            {fragmentChapters.length > 0 && (
              <button onClick={handleCleanFragments} disabled={busyAction !== null}
                className="btn btn-outline btn-sm">
                {busyAction === 'clean-fragments' ? '清理中…' : `🧹 清理碎片章 (${fragmentChapters.length})`}
              </button>
            )}

            {/* ★ 2026-08-22 A3：目录驱动分章 */}
            <button onClick={handleSplitByToc} disabled={busyAction !== null}
              className="btn btn-outline btn-sm" title="AI 提取教材目录，按目录条目在正文锚点切章（适合扫描件/正则分章失真的教材）">
              {busyAction === 'split-by-toc' ? '🤖 目录分章中…' : '📑 按目录重新分章'}
            </button>

            <span className="text-[var(--ink-300)] text-xs">
              勾选≥2个相邻章节可合并{bigChapters.length > 0 ? ` · ${bigChapters.length} 个章节过大建议再分` : ''}
            </span>
          </div>
        </div>
      )}

      {/* 确认结构化 */}
      {!isLocked ? (
        <div className="border-[var(--ink-100)] text-center py-4 border-t">
          <p className="text-[var(--ink-400)] text-xs mb-3">
            确认章节结构后，章节将锁定不可编辑，并进入「出题配置」阶段（随时可解锁重新整理）
          </p>
          <button onClick={handleConfirm} disabled={confirming}
            className="btn btn-fox">
            {confirming ? '确认中…' : '✅ 确认章节结构'}
          </button>
        </div>
      ) : (
        /* ★ 2026-08-22：已锁定时的解锁入口 */
        <div className="border-[var(--ink-100)] text-center py-4 border-t">
          <p className="text-[var(--ink-400)] text-xs mb-3">章节结构已确认并锁定</p>
          <button onClick={handleReopen} disabled={busyAction !== null}
            className="btn btn-outline btn-sm">
            {busyAction === 'reopen' ? '解锁中…' : '🔓 解锁结构（重新整理章节）'}
          </button>
        </div>
      )}
    </div>
  );
}
