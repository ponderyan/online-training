// 视频课程列表表格（自 page.tsx 迁出，纯重构零行为变化）
'use client';

import { TYPE_NAMES, TYPE_COLORS, STATUS_NAMES, STATUS_COLORS, assetUrl, fmtDuration } from './video-course-constants';

export function VideoCourseTable({ videos, loading, onPreview, onDetail, onEdit, onLogs, onPublish, onUnpublish, onDelete }: {
  videos: any[];
  loading: boolean;
  onPreview: (v: any) => void;
  onDetail: (v: any) => void;
  onEdit: (v: any) => void;
  onLogs: (v: any) => void;
  onPublish: (v: any) => void;
  onUnpublish: (v: any) => void;
  onDelete: (v: any) => void;
}) {
  return (
    <>
      <p className="text-[var(--ink-300)] text-[10px] mb-2">💡 双击视频行可快速预览</p>
      {loading ? (
        <div className="text-[var(--ink-300)] text-center py-16">加载中… 🦊</div>
      ) : videos.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-4">🎬</p><p className="text-[var(--ink-300)]">暂无视频课程</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="list-table">
            <thead><tr>
              <th>视频</th><th>类型</th><th>讲师</th><th>时长</th><th>发布状态</th><th>视频状态</th><th>关联课程</th><th>操作</th>
            </tr></thead>
            <tbody>
              {videos.map((v: any) => (
                <tr key={v.id} onDoubleClick={() => onPreview(v)} className="group cursor-pointer">
                  <td className="relative group/row">
                    <div className="flex items-center gap-2">
                      {v.coverUrl ? (
                        <img src={assetUrl(v.coverUrl)} alt="" className="rounded flex-shrink-0" style={{ width: 40, height: 27, objectFit: 'cover' }} />
                      ) : (
                        <div className="rounded flex-shrink-0 flex items-center justify-center text-xs bg-[var(--ink-100)]" style={{ width: 40, height: 27,  }}>🎬</div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{v.name}</div>
                        {v.hours ? <div className="text-[var(--ink-300)] text-xs">{v.hours}h {v.duration ? `· ${fmtDuration(v.duration)}` : ''}</div> : ''}
                      </div>
                    </div>
                    {/* hover 浮动信息 */}
                    <div className="hidden group-hover/row:block absolute left-2 top-full mt-1 z-50 w-72 p-3 rounded-lg shadow-lg border text-xs bg-[var(--paper-bright)] border-[var(--ink-200)]" >
                      <p className="font-semibold text-sm mb-1">{v.name}</p>
                      {v.description && <p className="text-[var(--ink-400)] mb-1.5">{v.description.length > 80 ? v.description.slice(0, 80) + '…' : v.description}</p>}
                      <div className="text-[var(--ink-400)] flex gap-4">
                        <span>讲师：{v.instructorName || '—'}</span>
                        {v.instructorLevel && <span>职称：{v.instructorLevel}</span>}
                      </div>
                      {v.courseLinks?.length > 0 && <p className="text-[var(--ink-300)] mt-1">关联课程：{v.courseLinks.map((cl: any) => cl.course?.name).join('、')}</p>}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${TYPE_COLORS[v.type] || 'var(--neutral-400)'} 10%, transparent)`, color: TYPE_COLORS[v.type] || 'var(--neutral-400)' }}>{TYPE_NAMES[v.type] || v.type}</span>
                      {v.isContinuingEducation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--sage-glow)] text-[var(--sage)]" >继续教育</span>}
                    </div>
                  </td>
                  <td className="text-[var(--ink-400)] text-xs">{v.instructorName || '—'}{v.instructorLevel ? ` (${v.instructorLevel})` : ''}</td>
                  <td className="text-[var(--ink-400)] text-xs">{v.duration ? fmtDuration(v.duration) : '—'}</td>
                  <td>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (STATUS_COLORS[v.status] || 'var(--neutral-400)') + '18', color: STATUS_COLORS[v.status] || 'var(--neutral-400)' }}>
                      {STATUS_NAMES[v.status] || v.status || 'DRAFT'}
                    </span>
                  </td>
                  <td>
                    {v.url ? (
                      v.url.startsWith('http') ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(21,101,192,0.09)] text-[var(--blue)]" >🔗 外部链接</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--sage-glow)] text-[var(--sage)]" >✅ 已上传</span>
                      )
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fox-glow)] text-[var(--ink-300)]" >⏳ 待上传</span>
                    )}
                  </td>
                  <td className="text-[var(--ink-400)] text-xs">
                    {v.courseLinks?.length > 0
                      ? `${v.courseLinks.slice(0, 2).map((cl: any) => cl.course?.name).join('、')}${v.courseLinks.length > 2 ? `…(+${v.courseLinks.length - 2})` : ''}`
                      : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => onDetail(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]" >详情</button>
                      <button onClick={() => onPreview(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]" >预览</button>
                      {v.status === 'DRAFT' && (
                        <button onClick={() => onPublish(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--sage)]" >上架</button>
                      )}
                      {v.status === 'PUBLISHED' && (
                        <button onClick={() => onUnpublish(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--error)]" >下架</button>
                      )}
                      {v.status === 'UNPUBLISHED' && (
                        <button onClick={() => onPublish(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--sage)]" >重新上架</button>
                      )}
                      <button onClick={() => onEdit(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--ink-500)]" >修改</button>
                      <button onClick={() => onLogs(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >日志</button>
                      <button onClick={() => onDelete(v)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--error)]" >删除</button>
                      <span className="text-[var(--ink-300)] text-[10px] ml-1 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0">双击预览</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
