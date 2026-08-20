'use client';

import { useRouter } from 'next/navigation';
import PipelineProgress from '@/components/pipeline-progress';
import { api } from '@/lib/api';

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

const FILE_ICONS: Record<string, string> = { pdf: '📘', pptx: '📗', docx: '📕', doc: '📕' };

export default function MaterialCard({ m, showArchivedBadge = false, onArchive, onUnarchive, onDelete }: {
  m: any;
  showArchivedBadge?: boolean;
  onArchive: (m: any) => void;
  onUnarchive: (m: any) => void;
  onDelete: (m: any) => void;
}) {
  const router = useRouter();
    // ★ 2026-08-20 P1 后台化：失败教材重试（重新入队，轮询会自动跟进状态）
    const handleReprocess = async () => {
      try {
        await api.materials.reprocess(m.id);
      } catch { /* 错误已由后端写入 errorMessage，轮询会展示 */ }
    };
    const actionBtn = (() => {
      switch (m.status) {
        case 'UPLOADED':
          return m.errorMessage
            ? (
              <>
                <button className="btn btn-fox btn-xs" onClick={handleReprocess}>🔁 重试识别</button>
                <button className="btn btn-verm btn-xs" onClick={() => onDelete(m)}>删除</button>
              </>
            )
            : <span className="text-[var(--ink-300)] text-xs">⏳ 排队中…</span>;
        case 'PROCESSING':
          // ★ 后台化后展示真实进度（后端里程碑：5入队/30提取/40OCR/100完成）
          return <span className="text-[var(--gold)] text-xs">⏳ 识别中… {typeof m.processingProgress === 'number' ? `${m.processingProgress}%` : ''}</span>;
        case 'GENERATING':
          return <span className="text-[var(--gold)] text-xs">⏳ 处理中…</span>;
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
          return <button className="btn btn-verm btn-xs" onClick={() => onDelete(m)}>重试</button>;
        default:
          return null;
      }
    })();

    return (
      <div key={m.id} className={`card p-4 ${showArchivedBadge ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0">{FILE_ICONS[m.fileType] || '📄'}</span>
            <h3 className="text-[var(--ink-700)] text-sm font-medium truncate">{m.name}</h3>
            {showArchivedBadge && <span className="tag tag-ink text-[10px]">已归档</span>}
          </div>
          <span className={`tag flex-shrink-0 ${(STATUS[m.status]?.cls) || 'tag-ink'}`}>
            {STATUS[m.status]?.label || m.status}
          </span>
        </div>
        <div className="text-[var(--ink-400)] flex flex-wrap gap-x-3 gap-y-0.5 text-xs mb-2">
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
          <div className="text-xs p-2 rounded mb-2 bg-[var(--verm-glow)] text-[var(--verm)]" >
            ⚠ {m.errorMessage}
          </div>
        )}

        {/* 操作栏 */}
        <div className="border-[var(--ink-100)] flex gap-2 pt-2 border-t">
          {actionBtn}
          <div className="flex-1" />
          {m.archivedAt ? (
            <>
              <button onClick={() => onUnarchive(m)} className="btn btn-ghost btn-xs text-[var(--fox)]" 
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fox)')}>恢复</button>
              <button onClick={() => onDelete(m)} className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>彻底删除</button>
            </>
          ) : m.status !== 'UPLOADED' && m.status !== 'FAILED' ? (
            <button onClick={() => onArchive(m)} className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>归档</button>
          ) : (
            <button onClick={() => onDelete(m)} className="btn btn-ghost btn-xs text-[var(--ink-300)]" 
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
          )}
        </div>
      </div>
    );
}
