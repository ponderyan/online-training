'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import ChapterStructureTab from './chapter-structure-tab';
import QuestionPlanTab from './question-plan-tab';
import ReviewTab from './review-tab';

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const materialId = Number(params.id);
  const toast = useToast();

  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'plan' || tab === 'review' || tab === 'structure') return tab;
    return 'structure';
  });

  const load = useCallback(async () => {
    try {
      const data = await api.materials.get(materialId);
      setMaterial(data);
    } catch { router.push('/materials'); }
    setLoading(false);
  }, [materialId]);

  useEffect(() => { load(); }, [load]);

  const reviewCounts = {
    all: material?.questions?.length || 0,
    pending: material?.questions?.filter((q: any) => q.reviewStatus === 'PENDING').length || 0,
    approved: material?.questions?.filter((q: any) => q.reviewStatus === 'APPROVED').length || 0,
    rejected: material?.questions?.filter((q: any) => q.reviewStatus === 'REJECTED').length || 0,
    edited: material?.questions?.filter((q: any) => q.reviewStatus === 'EDITED').length || 0,
  };

  const handleBatchImport = async () => {
    if (!confirm('确认一键导入全部待审核试题到题库？')) return;
    setImporting(true);
    try {
      await api.materials.batchReview(materialId, { action: 'approve' });
      load();
    } catch (e: any) {
      toast.error('导入失败：' + e.message);
    }
    setImporting(false);
  };

  const handleAiGenerate = async () => {
    if (!confirm('确认使用大模型生成试题？将覆盖该教材之前生成的所有试题。')) return;
    setGenerating(true);
    try {
      const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/materials/${materialId}/generate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const err = await res.text(); throw new Error(err); }
      const data = await res.json();
      toast.success(`AI 出题完成！生成了 ${data.total} 道试题（共 ${data.chapters} 个章节），请逐题审核。`);
      load();
    } catch (e: any) { toast.error('出题失败：' + e.message); }
    setGenerating(false);
  };

  if (loading) return (
    <AppLayout>
      <div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载… 🦊</div>
    </AppLayout>
  );
  if (!material) return null;

  const totalQuestions = material.questions?.length || 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push('/materials')}
              className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]"
              >← 返回教材列表</button>
          </div>
          <h1 className="page-title">{material.name}</h1>
          <p className="page-subtitle">
            {material.subject?.code} · {material.chapters?.length || 0} 章 · 共 {totalQuestions} 题
            &nbsp;|&nbsp;
            待审核 <span className="text-[var(--fox)]">{reviewCounts.pending}</span>
            &nbsp;·&nbsp; 已通过 {reviewCounts.approved}
            &nbsp;·&nbsp; 已拒绝 {reviewCounts.rejected}
            {reviewCounts.edited > 0 && <>&nbsp;·&nbsp; 已修改 {reviewCounts.edited}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'review' && material?.chapters?.some((ch: any) => ch.content) && !['PROCESSING', 'GENERATING'].includes(material?.status) && (
            <button onClick={handleAiGenerate} disabled={generating}
              className="btn btn-outline btn-sm">
              {generating ? '🤖 出题中…' : '🤖 AI生成试题'}
            </button>
          )}
          {material?.status === 'PROCESSING' && (
            <span className="text-[var(--gold)] text-xs self-center">⏳ 正在生成试题…</span>
          )}
          {reviewCounts.pending > 0 && (
            <button onClick={handleBatchImport} disabled={importing}
              className="btn btn-fox btn-sm">
              {importing ? '导入中…' : `一键导入全部 (${reviewCounts.pending})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab 导航 ── */}
      <div className="border-[var(--ink-100)] flex gap-1 mb-6 border-b">
        {[
          { key: 'structure', label: '📖 章节结构', condition: true },
          { key: 'plan', label: '🤖 出题配置', condition: material.status !== 'UPLOADED' && material.status !== 'FAILED' },
          { key: 'review', label: '📝 试题审核', condition: totalQuestions > 0 || material.status === 'PROCESSING' || material.status === 'GENERATING' },
        ].filter(t => t.condition).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent"
            style={{
              borderColor: activeTab === tab.key ? 'var(--fox)' : 'transparent',
              color: activeTab === tab.key ? 'var(--ink-800)' : 'var(--ink-300)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 内容 ── */}
      {activeTab === 'structure' && (
        <ChapterStructureTab
          materialId={materialId}
          chapters={material.chapters || []}
          onConfirm={load}
        />
      )}

      {activeTab === 'plan' && (
        <QuestionPlanTab
          materialId={materialId}
          materialStatus={material.status}
          chapters={material.chapters || []}
          pendingCount={(reviewCounts.pending || 0) + (reviewCounts.rejected || 0)}
          onGenerate={load}
        />
      )}

      {activeTab === 'review' && (
        <ReviewTab
          materialId={materialId}
          material={material}
          reviewCounts={reviewCounts}
          onReload={load}
        />
      )}
    </AppLayout>
  );
}
