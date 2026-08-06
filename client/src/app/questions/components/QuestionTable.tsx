import { Brain } from 'lucide-react';
import { TYPE_LABELS, DIFF_LABELS } from '../lib';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonTable } from '@/components/Skeleton';
import { api } from '@/lib/api';

interface Props {
  questions: any[];
  loading: boolean;
  error: string | null;
  selectedIds: Set<number>;
  selectMode: boolean;
  page: number;
  pageSize: number;
  editingId: number | null;
  isSuperAdmin: boolean;
  bankPolicy: { org_bank_visibility: string; allow_org_own_bank?: boolean } | null;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onRowDoubleClick: (q: any) => void;
  onView: (q: any) => void;
  onEdit: (q: any) => void;
  onToggleStatus: (q: any) => void;
  onOpenKp: (q: any) => void;
  onDelete: (q: any) => void;
  onShowRefs: (id: number) => void;
  onRetry: () => void;
  onShowAdd: () => void;
  setViewQuestion: (q: any) => void;
}

export default function QuestionTable({
  questions, loading, error, selectedIds, selectMode,
  page, pageSize, editingId, isSuperAdmin, bankPolicy,
  onToggleSelectAll, onToggleSelect, onRowDoubleClick,
  onView, onEdit, onToggleStatus, onOpenKp, onDelete, onShowRefs,
  onRetry, onShowAdd, setViewQuestion,
}: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="list-table">
        <thead>
          <tr>
            <th style={{ width: '32px', textAlign: 'center' }}>
              <input type="checkbox" checked={selectMode} onChange={onToggleSelectAll}
                style={{ cursor: 'pointer', accentColor: 'var(--fox)' }} />
            </th>
            <th style={{ width: '38px', textAlign: 'center' }}>#</th>
            <th className="w-[30%]">试题内容</th>
            <th className="w-[7%]">题型</th>
            <th className="w-[7%]">难度</th>
            <th className="w-[6%]">科目</th>
            <th className="w-[7%]">来源</th>
            <th className="w-[8%]">创建时间</th>
            <th className="w-[5%]">状态</th>
            <th className="w-[5%]">引用</th>
            <th className="w-[14%]">操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={11} style={{ padding: 0 }}><SkeletonTable rows={6} cols={6} /></td></tr>
          ) : error ? (
            <tr><td colSpan={11}><ErrorCard message={error} onRetry={onRetry} /></td></tr>
          ) : questions.length === 0 ? (
            <tr><td colSpan={11}>
              <EmptyState icon="🦊" title="还没有试题" description="点击右上角「录入试题」开始">
                <button onClick={onShowAdd} className="btn btn-fox btn-sm">录入试题</button>
              </EmptyState>
            </td></tr>
          ) : questions.map((q: any, idx: number) => (
            <tr key={q.id}
              onDoubleClick={() => onRowDoubleClick(q)}
              className="cursor-pointer"
              style={{
                background: selectedIds.has(q.id) ? 'var(--fox-pale)' : undefined,
                opacity: q.status === 'ARCHIVED' ? 0.5 : undefined,
              }}>
              <td className="text-center" onClick={e => e.stopPropagation()}>
                <input type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => q.status !== 'ARCHIVED' && onToggleSelect(q.id)}
                  disabled={q.status === 'ARCHIVED'}
                  style={{ cursor: q.status === 'ARCHIVED' ? 'not-allowed' : 'pointer', accentColor: 'var(--fox)', opacity: q.status === 'ARCHIVED' ? 0.3 : 1 }} />
              </td>
              <td className="text-center text-xs" style={{ color: 'var(--ink-300)', fontFamily: 'monospace' }}>
                {(page - 1) * pageSize + idx + 1}
              </td>
              <td>
                <span className="line-clamp-1 text-sm">{q.content}</span>
              </td>
              <td><span className="tag tag-ink">{TYPE_LABELS[q.type]}</span></td>
              <td><span className={`tag ${DIFF_LABELS[q.difficulty]?.cls}`}>{DIFF_LABELS[q.difficulty]?.label}</span></td>
              <td><span className="tag tag-gold">{q.subject?.code}</span></td>
              <td className="text-xs" style={{ color: 'var(--ink-400)', maxWidth: 0, overflow: 'hidden' }}>
                {q.materialName ? (
                  <span className="max-w-[100%] truncate block" title={`${q.materialName}${q.chapterTitle ? ` > ${q.chapterTitle}` : ''}`}>
                    📖 {q.materialName}{q.chapterTitle ? ` > ${q.chapterTitle}` : ''}
                  </span>
                ) : q.orgId ? (
                  <>
                    {q.source === 'MANUAL' ? '手动' : q.source === 'AI_IMPORT' ? 'AI' : '批量导入'}
                    <span className="ml-1.5 tag tag-gold" style={{ fontSize: '10px', padding: '1px 5px' }}>
                      机构
                    </span>
                  </>
                ) : (
                  q.source === 'MANUAL' ? '手动' : q.source === 'AI_IMPORT' ? 'AI' : '批量导入'
                )}
              </td>
              <td className="text-[var(--ink-400)] text-xs">
                {q.createdAt ? new Date(q.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—'}
              </td>
              <td>
                <span className={`tag ${q.status === 'PUBLISHED' ? 'tag-cyan' : 'tag-ink'}`}>
                  {q.status === 'PUBLISHED' ? '启用' : '已停用'}
                </span>
              </td>
              <td>
                <span className="text-xs cursor-pointer hover:text-[var(--fox)] transition-colors"
                  style={{ color: q._count?.paperQuestions > 0 ? 'var(--ink-500)' : 'var(--ink-200)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (q._count?.paperQuestions > 0) onShowRefs(q.id);
                  }}>
                  {q._count?.paperQuestions || 0}次
                </span>
              </td>
              <td>
                {(() => {
                  const isOrgQuestion = q.orgId !== null;
                  const isViewOnly = isOrgQuestion && isSuperAdmin && bankPolicy?.org_bank_visibility === 'view_only';
                  return (
                  <div className="flex gap-1.5">
                    <button onClick={async (e) => { e.stopPropagation(); try { const full = await api.questions.get(q.id); setViewQuestion(full); } catch { setViewQuestion(q); } }}
                      className="btn btn-xs btn-ghost">详情</button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(q); }}
                      className="btn btn-xs btn-ghost"
                      disabled={isViewOnly || editingId === q.id}
                      style={{ opacity: isViewOnly ? 0.4 : 1, cursor: isViewOnly ? 'not-allowed' : 'pointer' }}>{editingId === q.id ? '…' : '编辑'}</button>
                    {q.status === 'PUBLISHED' ? (
                      <button onClick={(e) => { e.stopPropagation(); onToggleStatus(q); }}
                        className="btn btn-xs" style={{ color: 'var(--verm)', opacity: isViewOnly ? 0.4 : 1, cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
                        disabled={isViewOnly}>停用</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); onToggleStatus(q); }}
                        className="btn btn-xs" style={{ color: 'var(--cyan)', opacity: isViewOnly ? 0.4 : 1, cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
                        disabled={isViewOnly}>启用</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onOpenKp(q); }}
                      className="btn btn-xs btn-ghost text-[var(--fox)] hover:text-[var(--fox-dark)]"><Brain size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(q); }}
                      className="btn btn-xs btn-ghost text-[var(--ink-300)] hover:text-[var(--error)] transition-colors"
                      style={{ opacity: isViewOnly ? 0.4 : 1, cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
                      disabled={isViewOnly}>删除</button>
                  </div>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
