'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import MaterialCard from './components/material-card';
import UploadModal from './components/upload-modal';
import ManualEntryModal from './components/manual-entry-modal';

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

export default function MaterialsPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');

  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [archivedMaterials, setArchivedMaterials] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (subjectIdParam) params.subjectId = subjectIdParam;

      const [data, subjData] = await Promise.all([
        api.materials.list(params),
        api.subjects.listActive().catch(() => []),
      ]);
      setMaterials(data.items || []);
      setSubjects((Array.isArray(subjData) ? subjData : []).filter((s: any) => s.isActive !== false));

      // 加载已归档教材
      try {
        const archived = await api.materials.list({ ...params, includeArchived: 'true' });
        setArchivedMaterials((archived.items || []).filter((m: any) => m.archivedAt));
      } catch {}
    } catch (e: any) {
      setError(e.message || '加载教材列表失败');
    }
    setLoading(false);
  }, [subjectIdParam]);

  useEffect(() => { load(); }, [load]);

  // ★ 2026-08-20 P1 后台化：存在后台处理中教材（OCR 异步）时每 3s 静默轮询状态，全部完成后自动停止
  const hasActiveJob = materials.some(m => m.status === 'UPLOADED' || m.status === 'PROCESSING');
  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = setInterval(async () => {
      try {
        const params: Record<string, string> = {};
        if (subjectIdParam) params.subjectId = subjectIdParam;
        const data = await api.materials.list(params);
        setMaterials(data.items || []);
      } catch { /* 轮询失败静默，下轮重试 */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [hasActiveJob, subjectIdParam]);

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
      toast.success('教材已归档');
      load();
    } catch (e: any) { toast.error('归档失败：' + e.message); }
  };
  const handleUnarchive = async (m: any) => {
    try {
      await api.materials.unarchive(m.id);
      toast.success('教材已恢复');
      load();
    } catch (e: any) { toast.error('恢复失败：' + e.message); }
  };
  const handleDelete = async (m: any) => {
    if (!confirm(`确认彻底删除「${m.name}」？\n\n⚠️ 此操作不可撤销。\n- 已入库的试题不受影响（来源快照已保留）\n- 尚未入库的待审核试题将被丢弃`)) return;
    if (!confirm('再次确认：删除后不可恢复，确定要永久删除吗？')) return;
    try {
      await api.materials.delete(m.id);
      toast.success('教材已删除');
      load();
    } catch (e: any) { toast.error('删除失败：' + e.message); }
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
        <div className="text-[var(--ink-600)] text-xs font-medium truncate">{subject.name}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[var(--fox)] text-sm font-bold">{total}</span>
          <span className="text-[var(--ink-300)] text-xs">本教材</span>
        </div>
        {hasIssues > 0 && <div className="text-[var(--verm)] text-xs mt-1">● {hasIssues} 待处理</div>}
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
                className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]"
                >← 返回科目总览</button>
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
        <SkeletonCardGrid count={6} />
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
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
                      {count > 0 && <span className="text-[var(--fox)] text-[10px] font-bold">{count}份</span>}
                    </div>
                    {idx < 4 && <div className="bg-[var(--ink-100)] w-6 h-px mx-1 mb-4" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pipeline 看板分组 */}
          <div className="space-y-6">
            {pipelineGroups.filter(g => g.items.length > 0).map(g => (
              <div key={g.key}>
                <h3 className="text-[var(--ink-500)] text-sm font-medium mb-3">
                  {g.label} · {g.items.length} 份
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                  {g.items.map(m => <MaterialCard key={m.id} m={m} onArchive={handleArchive} onUnarchive={handleUnarchive} onDelete={handleDelete} />)}
                </div>
              </div>
            ))}

            {/* 已归档 */}
            {archivedMaterials.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(!showArchived)}
                  className="text-sm font-medium mb-3 flex items-center gap-1 bg-transparent border-none cursor-pointer text-[var(--ink-400)]"
                  >
                  📦 已归档 · {archivedMaterials.length} 份 {showArchived ? '▲' : '▼'}
                </button>
                {showArchived && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                    {archivedMaterials.map(m => <MaterialCard key={m.id} m={m} showArchivedBadge onArchive={handleArchive} onUnarchive={handleUnarchive} onDelete={handleDelete} />)}
                  </div>
                )}
              </div>
            )}

            {pipelineGroups.every(g => g.items.length === 0) && archivedMaterials.length === 0 && (
              <div className="card"><EmptyState icon="📭" title="该科目暂无教材" description="上传教材后，AI 会自动识别章节并辅助出题" size="small" /></div>
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
                <div className="text-[var(--ink-400)] text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 科目卡片网格 */}
          {subjects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[var(--ink-500)] text-sm font-medium mb-3">按科目浏览</h3>
              <div className="flex gap-3 flex-wrap">
                {subjects.map(renderSubjectCard)}
              </div>
            </div>
          )}

          {/* 全部教材列表（按科目分组） */}
          {materials.length > 0 ? (
            <div>
              <h3 className="text-[var(--ink-500)] text-sm font-medium mb-3">全部教材</h3>
              {Object.entries(materialsBySubject).map(([sid, items]) => {
                const subject = subjects.find((s: any) => s.id === Number(sid));
                return (
                  <div key={sid} className="mb-6">
                    <h4 className="text-[var(--ink-400)] text-xs font-semibold mb-2 px-1">
                      {subject?.code || '其他'} — {subject?.name || '未分类'} · {items.length} 本
                    </h4>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3">
                      {items.map(m => <MaterialCard m={m} onArchive={handleArchive} onUnarchive={handleUnarchive} onDelete={handleDelete} />)}
                    </div>
                  </div>
                );
              })}

              {/* 已归档 */}
              {archivedMaterials.length > 0 && (
                <button onClick={() => setShowArchived(!showArchived)}
                  className="text-sm font-medium flex items-center gap-1 bg-transparent border-none cursor-pointer mb-3 text-[var(--ink-400)]"
                  >
                  📦 已归档 · {archivedMaterials.length} 份 {showArchived ? '▲' : '▼'}
                </button>
              )}
              {showArchived && archivedMaterials.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3 mb-6">
                  {archivedMaterials.map(m => <MaterialCard m={m} showArchivedBadge onArchive={handleArchive} onUnarchive={handleUnarchive} onDelete={handleDelete} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <EmptyState icon="📖" title="还没有教材" description="上传教材（PDF/PPTX/Word）→ AI自动识别章节 → 智能出题">
                <button onClick={() => setShowUpload(true)} className="btn btn-fox">上传第一本教材</button>
              </EmptyState>
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
