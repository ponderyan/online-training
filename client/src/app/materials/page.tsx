'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import PipelineProgress from '@/components/pipeline-progress';

const STATUS: Record<string, { label: string; cls: string }> = {
  UPLOADED: { label: '待处理', cls: 'tag-ink' },
  PROCESSING: { label: '处理中', cls: 'tag-gold' },
  OCR_DONE: { label: '已识别', cls: 'tag-cyan' },
  STRUCTURED: { label: '已结构化', cls: 'tag-cyan' },
  GENERATING: { label: '出题中', cls: 'tag-gold' },
  GENERATED: { label: '待审核', cls: 'tag-fox' },
  REVIEWING: { label: '审核中', cls: 'tag-fox' },
  COMPLETED: { label: '已完成', cls: 'tag-cyan' },
  FAILED: { label: '失败', cls: 'tag-verm' },
};

/** 教材在 Pipeline 中的分组 */
const PIPELINE_GROUPS = [
  { key: 'upload', label: '📤 待处理', statuses: ['UPLOADED', 'PROCESSING'] },
  { key: 'recognize', label: '🔍 已识别待复核', statuses: ['OCR_DONE'] },
  { key: 'review', label: '📋 待复核章节', statuses: ['STRUCTURED'] },
  { key: 'generate', label: '🤖 出题中', statuses: ['GENERATING'] },
  { key: 'audit', label: '📝 待审核', statuses: ['GENERATED', 'REVIEWING'] },
  { key: 'done', label: '✅ 已完成', statuses: ['COMPLETED'] },
  { key: 'failed', label: '❌ 失败', statuses: ['FAILED'] },
];

// 已归档分组
const ARCHIVED_FILTER = { label: '📦 已归档', statuses: [] as string[] };

const FILE_ICONS: Record<string, string> = { pdf: '📘', pptx: '📗', docx: '📕', doc: '📕' };

export default function MaterialsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');

  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [archivedMaterials, setArchivedMaterials] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (subjectIdParam) params.subjectId = subjectIdParam;

      const [data, subjData] = await Promise.all([
        api.materials.list(params),
        api.subjects.list().catch(() => []),
      ]);
      setMaterials(data.items || []);
      setSubjects((Array.isArray(subjData) ? subjData : []).filter((s: any) => s.isActive !== false));

      // 加载已归档教材
      try {
        const archived = await api.materials.list({ ...params, includeArchived: 'true' });
        setArchivedMaterials((archived.items || []).filter((m: any) => m.archivedAt));
      } catch {}
    } catch {}
    setLoading(false);
  }, [subjectIdParam]);

  useEffect(() => { load(); }, [load]);

  // ── 统计 ──
  const pendingReview = materials.filter(m => m.status === 'GENERATED').length;
  const pendingStructure = materials.filter(m => m.status === 'STRUCTURED').length;
  const processing = materials.filter(m => m.status === 'PROCESSING' || m.status === 'GENERATING').length;
  const doneCount = materials.filter(m => m.status === 'COMPLETED').length;

  // 按科目分组
  const materialsBySubject: Record<number, any[]> = {};
  for (const m of materials) {
    const sid = m.subjectId;
    if (!materialsBySubject[sid]) materialsBySubject[sid] = [];
    materialsBySubject[sid].push(m);
  }

  // ── Pipeline 看板（科目详情页）──
  const pipelineGroups = PIPELINE_GROUPS.map(g => ({
    ...g,
    items: materials.filter(m => g.statuses.includes(m.status)),
  }));

  // ── 归档/取消归档/删除 ──
  const handleArchive = async (m: any) => {
    if (!confirm(`确认归档「${m.name}」？\n\n已入库的试题不受影响，可在「已归档」区查看和恢复。`)) return;
    try {
      await api.materials.archive(m.id);
      load();
    } catch (e: any) { alert('归档失败：' + e.message); }
  };
  const handleUnarchive = async (m: any) => {
    try {
      await api.materials.unarchive(m.id);
      load();
    } catch (e: any) { alert('恢复失败：' + e.message); }
  };
  const handleDelete = async (m: any) => {
    if (!confirm(`确认彻底删除「${m.name}」？\n\n⚠️ 此操作不可撤销。\n- 已入库的试题不受影响（来源快照已保留）\n- 尚未入库的待审核试题将被丢弃`)) return;
    if (!confirm('再次确认：删除后不可恢复，确定要永久删除吗？')) return;
    try {
      await api.materials.delete(m.id);
      load();
    } catch (e: any) { alert('删除失败：' + e.message); }
  };

  // ── 渲染科目卡片 ──
  const renderSubjectCard = (subject: any) => {
    const subjMats = materialsBySubject[subject.id] || [];
    const total = subjMats.length;
    const hasIssues = subjMats.filter(m => m.status === 'FAILED' || m.status === 'UPLOADED').length;
    return (
      <div key={subject.id} onClick={() => router.push(`/materials?subjectId=${subject.id}`)}
        className="card p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md min-w-[140px]"
        style={{ borderColor: hasIssues > 0 ? 'var(--verm-glow)' : 'var(--ink-100)' }}>
        <div className="text-lg mb-1">{subject.code}</div>
        <div className="text-xs font-medium truncate" style={{ color: 'var(--ink-600)' }}>{subject.name}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--fox)' }}>{total}</span>
          <span className="text-xs" style={{ color: 'var(--ink-300)' }}>本教材</span>
        </div>
        {hasIssues > 0 && <div className="text-xs mt-1" style={{ color: 'var(--verm)' }}>● {hasIssues} 待处理</div>}
      </div>
    );
  };

  // ── 渲染教材卡片 ──
  const renderMaterialCard = (m: any, showArchivedBadge = false) => {
    const actionBtn = (() => {
      switch (m.status) {
        case 'UPLOADED':
          return m.errorMessage
            ? <button className="btn btn-verm btn-xs" onClick={() => handleDelete(m)}>删除</button>
            : <span className="text-xs" style={{ color: 'var(--ink-300)' }}>⏳ 等待处理…</span>;
        case 'PROCESSING':
        case 'GENERATING':
          return <span className="text-xs" style={{ color: 'var(--gold)' }}>⏳ 处理中…</span>;
        case 'OCR_DONE':
          return <button className="btn btn-fox btn-xs" onClick={() => router.push(`/materials/${m.id}`)}>📋 复核章节结构</button>;
        case 'STRUCTURED':
          return <button className="btn btn-fox btn-xs" onClick={() => router.push(`/materials/${m.id}?tab=plan`)}>🤖 配置出题</button>;
        case 'GENERATED':
        case 'REVIEWING':
          return <button className="btn btn-fox btn-xs" onClick={() => router.push(`/materials/${m.id}`)}>📝 去审核（{m._count?.questions || 0}）</button>;
        case 'COMPLETED':
          return <button className="btn btn-outline btn-xs" onClick={() => router.push(`/materials/${m.id}`)}>查看详情</button>;
        case 'FAILED':
          return <button className="btn btn-verm btn-xs" onClick={() => handleDelete(m)}>重试</button>;
        default:
          return null;
      }
    })();

    return (
      <div key={m.id} className={`card p-4 ${showArchivedBadge ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0">{FILE_ICONS[m.fileType] || '📄'}</span>
            <h3 className="text-sm font-medium truncate" style={{ color: 'var(--ink-700)' }}>{m.name}</h3>
            {showArchivedBadge && <span className="tag tag-ink text-[10px]">已归档</span>}
          </div>
          <span className={`tag flex-shrink-0 ${(STATUS[m.status]?.cls) || 'tag-ink'}`}>
            {STATUS[m.status]?.label || m.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mb-2" style={{ color: 'var(--ink-400)' }}>
          <span>{m.fileType?.toUpperCase() || '—'}</span>
          {m.totalPages && <span>{m.totalPages} 页</span>}
          <span>{new Date(m.createdAt).toLocaleDateString('zh-CN')}</span>
          <span>{m.subject?.code || '—'}</span>
          <span>{m._count?.chapters || 0} 章 · {m._count?.questions || 0} 题</span>
        </div>

        {/* Pipeline 进度条 */}
        <div className="mb-3">
          <PipelineProgress
            status={m.status}
            hasChapters={(m._count?.chapters || 0) > 0}
            totalQuestions={m._count?.questions || 0}
            archived={!!m.archivedAt}
          />
        </div>

        {/* 错误提示 */}
        {m.errorMessage && (
          <div className="text-xs p-2 rounded mb-2" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
            ⚠ {m.errorMessage}
          </div>
        )}

        {/* 操作栏 */}
        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--ink-100)' }}>
          {actionBtn}
          <div className="flex-1" />
          {m.archivedAt ? (
            <>
              <button onClick={() => handleUnarchive(m)} className="btn btn-ghost btn-xs" style={{ color: 'var(--fox)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fox)')}>恢复</button>
              <button onClick={() => handleDelete(m)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>彻底删除</button>
            </>
          ) : m.status !== 'UPLOADED' && m.status !== 'FAILED' ? (
            <button onClick={() => handleArchive(m)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>归档</button>
          ) : (
            <button onClick={() => handleDelete(m)} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      {/* ── 标题 + 操作 ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {subjectIdParam && (
              <button onClick={() => router.push('/materials')}
                className="text-xs bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--fox)' }}>← 返回科目总览</button>
            )}
          </div>
          <h1 className="page-title">
            {subjectIdParam
              ? `📖 ${subjects.find((s: any) => s.id === Number(subjectIdParam))?.name || '教材'}`
              : '📖 教材出题工作台'}
          </h1>
          <p className="page-subtitle">
            上传教材（PDF/PPTX/Word）→ AI自动出题 → 逐题审核入库
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEntry(true)} className="btn btn-ink btn-sm">📝 录入正文</button>
          <button onClick={() => setShowUpload(true)} className="btn btn-fox btn-sm">+ 上传教材</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : subjectIdParam ? (
        /* ════════════════════════════════════ */
        /* 科目流水线页                         */
        /* ════════════════════════════════════ */
        <div>
          {/* Pipeline 概览条 */}
          <div className="card p-4 mb-6">
            <div className="flex items-center justify-around">
              {PIPELINE_GROUPS.filter(g => g.key !== 'failed' && g.key !== 'done').map((g, idx) => {
                const count = pipelineGroups.find(pg => pg.key === g.key)?.items.length || 0;
                const isActive = count > 0;
                const nextKey = PIPELINE_GROUPS[idx + 1]?.key;
                return (
                  <div key={g.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: isActive ? 'var(--fox)' : 'var(--ink-100)', color: isActive ? '#fff' : 'var(--ink-300)' }}>
                        {idx + 1}
                      </div>
                      <span className="text-xs mt-1" style={{ color: isActive ? 'var(--ink-700)' : 'var(--ink-300)' }}>
                        {['上传', '识别', '复核', '出题', '审核'][idx]}
                      </span>
                      {count > 0 && <span className="text-[10px] font-bold" style={{ color: 'var(--fox)' }}>{count}份</span>}
                    </div>
                    {idx < 4 && <div className="w-6 h-px mx-1 mb-4" style={{ background: 'var(--ink-100)' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pipeline 看板分组 */}
          <div className="space-y-6">
            {pipelineGroups.filter(g => g.items.length > 0).map(g => (
              <div key={g.key}>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink-500)' }}>
                  {g.label} · {g.items.length} 份
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                  {g.items.map(m => renderMaterialCard(m))}
                </div>
              </div>
            ))}

            {/* 已归档 */}
            {archivedMaterials.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(!showArchived)}
                  className="text-sm font-medium mb-3 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                  style={{ color: 'var(--ink-400)' }}>
                  📦 已归档 · {archivedMaterials.length} 份 {showArchived ? '▲' : '▼'}
                </button>
                {showArchived && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                    {archivedMaterials.map(m => renderMaterialCard(m, true))}
                  </div>
                )}
              </div>
            )}

            {pipelineGroups.every(g => g.items.length === 0) && archivedMaterials.length === 0 && (
              <div className="card p-10 text-center" style={{ color: 'var(--ink-300)' }}>
                📭 该科目暂无教材
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════ */
        /* 科目总览页                           */
        /* ════════════════════════════════════ */

        <div>
          {/* 快速状态概览 */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {[
              { label: '待复核章节', count: pendingStructure, color: 'var(--fox)' },
              { label: '出题中', count: processing, color: 'var(--gold)' },
              { label: '待审核', count: pendingReview, color: 'var(--fox)' },
              { label: '已完成', count: doneCount, color: 'var(--cyan)' },
              { label: '全部教材', count: materials.length, color: 'var(--ink-400)' },
            ].filter(s => s.count > 0 || s.label === '全部教材').map(s => (
              <div key={s.label} className="card px-4 py-3 text-center min-w-[100px]">
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 科目卡片网格 */}
          {subjects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink-500)' }}>按科目浏览</h3>
              <div className="flex gap-3 flex-wrap">
                {subjects.map(renderSubjectCard)}
              </div>
            </div>
          )}

          {/* 全部教材列表（按科目分组） */}
          {materials.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink-500)' }}>全部教材</h3>
              {Object.entries(materialsBySubject).map(([sid, items]) => {
                const subject = subjects.find((s: any) => s.id === Number(sid));
                return (
                  <div key={sid} className="mb-6">
                    <h4 className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--ink-400)' }}>
                      {subject?.code || '其他'} — {subject?.name || '未分类'} · {items.length} 本
                    </h4>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                      {items.map(m => renderMaterialCard(m))}
                    </div>
                  </div>
                );
              })}

              {/* 已归档 */}
              {archivedMaterials.length > 0 && (
                <button onClick={() => setShowArchived(!showArchived)}
                  className="text-sm font-medium flex items-center gap-1 bg-transparent border-none cursor-pointer mb-3"
                  style={{ color: 'var(--ink-400)' }}>
                  📦 已归档 · {archivedMaterials.length} 份 {showArchived ? '▲' : '▼'}
                </button>
              )}
              {showArchived && archivedMaterials.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3 mb-6">
                  {archivedMaterials.map(m => renderMaterialCard(m, true))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20" style={{ color: 'var(--ink-300)' }}>
              <div className="text-4xl mb-4">📖</div>
              <p className="mb-2">小狐狸还没收到教材呢</p>
              <p className="text-xs mb-5">上传教材（PDF/PPTX/Word）→ AI自动识别章节 → 智能出题</p>
              <button onClick={() => setShowUpload(true)} className="btn btn-fox">上传第一本教材</button>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && <UploadModal subjects={subjects} onClose={() => { setShowUpload(false); load(); }} />}
      {/* Manual Entry Modal */}
      {showEntry && <ManualEntryModal subjects={subjects} onClose={() => { setShowEntry(false); load(); }} />}
    </AppLayout>
  );
}

// ══════════════════════════════════════════
// UploadModal 组件（代码同前）
// ══════════════════════════════════════════

function UploadModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [materialName, setMaterialName] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !!(e.target as HTMLElement)?.isContentEditable;
        if (!isEditable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async () => {
    if (!file || !subjectId) return;
    if (!batchNote.trim()) { alert('请填写出题要求，说明题型、数量和难度分布'); return; }
    setUploading(true);
    setProgress('上传中…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', materialName || file.name.replace(/\.(pdf|pptx|docx)$/i, ''));
      formData.append('subjectId', String(subjectId));
      formData.append('batchNote', batchNote);
      formData.append('createdBy', '1');
      const result = await api.materials.upload(formData);
      setProgress('✅ 上传成功！小狐狸马上开始处理');
      setTimeout(() => { onClose(); router.push(`/materials/${result.id}`); }, 1500);
    } catch (e: any) { setProgress('❌ ' + e.message); }
    setUploading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="modal-card max-w-[480px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📖 上传教材</h3>
          <button onClick={onClose} disabled={uploading}
            className="text-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)' }}>✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材名称</label>
            <input value={materialName} onChange={e => setMaterialName(e.target.value)}
              placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              出题要求 <span style={{ color: 'var(--verm)' }}>*必填</span>
            </label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'请详细描述出题要求…'}
              className="input textarea" rows={5} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材文件（PDF / PPTX / DOCX）</label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center transition-all"
              style={{ borderColor: file ? 'var(--fox)' : 'var(--ink-100)', background: file ? 'var(--fox-pale)' : 'var(--paper)' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && (f.type === 'application/pdf' || f.name.endsWith('.pptx') || f.name.endsWith('.docx'))) setFile(f);
              }}>
              {file ? (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button onClick={() => setFile(null)} className="btn btn-ghost btn-xs mt-2">重新选择</button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="text-3xl mb-2">📂</div>
                  <p className="text-sm" style={{ color: 'var(--ink-500)' }}>拖拽或点击上传</p>
                  <input type="file" accept=".pdf,.pptx,.docx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                </label>
              )}
            </div>
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={uploading} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!file || !subjectId || uploading}
            className="btn btn-fox btn-sm">{uploading ? '上传中…' : '上传并开始处理'}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ManualEntryModal 组件（代码同前）
// ══════════════════════════════════════════

function ManualEntryModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !subjectId || !content.trim()) { alert('请填写教材名称和正文内容'); return; }
    setSubmitting(true);
    setProgress('提交中…');
    try {
      const result = await api.materials.create({ name: name.trim(), subjectId: Number(subjectId), content: content.trim(), batchNote: batchNote.trim() || undefined });
      setProgress('✅ 创建成功！');
      setTimeout(() => { onClose(); router.push(`/materials/${result.id}`); }, 1500);
    } catch (e: any) { setProgress('❌ ' + e.message); }
    setSubmitting(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !!(e.target as HTMLElement)?.isContentEditable;
        if (!isEditable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="modal-card max-w-[560px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📝 录入正文</h3>
          <button onClick={onClose} disabled={submitting} className="text-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)' }}>✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>正文内容 <span style={{ color: 'var(--verm)' }}>*必填</span></label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={'请粘贴教材正文内容…'} className="input textarea" rows={12} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>出题要求 <span className="text-xs" style={{ color: 'var(--ink-400)' }}>（可选）</span></label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'示例：题型——单选题30道…'} className="input textarea" rows={3} />
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={submitting} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !subjectId || !content.trim() || submitting}
            className="btn btn-fox btn-sm">{submitting ? '提交中…' : '创建教材'}</button>
        </div>
      </div>
    </div>
  );
}
