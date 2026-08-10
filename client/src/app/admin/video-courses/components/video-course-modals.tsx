// 详情 / 预览 / 操作日志三个弹窗（自 page.tsx 迁出，纯重构零行为变化）
'use client';

export function VideoDetailModal({ video, onClose, onEdit, onPreview, onLogs }: {
  video: any;
  onClose: () => void;
  onEdit: (v: any) => void;
  onPreview: (v: any) => void;
  onLogs: (v: any) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">📋 {video.name}</h3>
          <button onClick={onClose} className="text-lg bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <span className="text-[var(--ink-300)] text-xs block">类型</span>
              <span className="tag mt-1" style={{
                background: video.type === 'PUBLIC' ? 'var(--cyan-glow)' : 'rgba(21,101,192,0.09)',
                color: video.type === 'PUBLIC' ? 'var(--info)' : 'var(--blue)',
                fontSize: '10px',
              }}>{video.type === 'PUBLIC' ? '公共课' : '专项课'}</span>
            </div>
            <div>
              <span className="text-[var(--ink-300)] text-xs block">继续教育学时</span>
              <span className="tag mt-1" style={{
                background: video.isContinuingEducation ? 'var(--sage-glow)' : 'var(--fox-glow)',
                color: video.isContinuingEducation ? 'var(--sage)' : 'var(--ink-300)',
                fontSize: '10px',
              }}>{video.isContinuingEducation ? '是' : '否'}</span>
            </div>
            <div>
              <span className="text-[var(--ink-300)] text-xs block">讲师</span>
              <p className="mt-0.5">{video.instructorName || '—'}{video.instructorLevel ? ` (${video.instructorLevel})` : ''}</p>
            </div>
            <div>
              <span className="text-[var(--ink-300)] text-xs block">课时 / 时长</span>
              <p className="mt-0.5">{video.hours ? `${video.hours}h` : '—'} · {video.duration ? `${video.duration}秒` : '—'}</p>
            </div>
          </div>
          {video.description && (
            <div>
              <span className="text-[var(--ink-300)] text-xs block mb-1">简介</span>
              <p className="text-[var(--ink-600)] text-sm">{video.description}</p>
            </div>
          )}
          {video.courseLinks?.length > 0 && (
            <div>
              <span className="text-[var(--ink-300)] text-xs block mb-1">关联课程</span>
              <div className="flex flex-wrap gap-1">
                {video.courseLinks.map((cl: any) => (
                  <span key={cl.id} className="tag bg-[rgba(123,31,162,0.09)] text-[var(--purple)]" style={{   fontSize: '10px' }}>
                    {cl.course?.name || '课程#' + cl.courseId}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="border-[var(--ink-100)] grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t">
            <div>
              <span className="text-[var(--ink-300)] text-xs block">创建时间</span>
              <p className="text-[var(--ink-400)] text-xs mt-0.5 font-mono">
                {new Date(video.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <span className="text-[var(--ink-300)] text-xs block">最后修改</span>
              <p className="text-[var(--ink-400)] text-xs mt-0.5 font-mono">
                {new Date(video.updatedAt).toLocaleString('zh-CN')}
              </p>
            </div>
            {video.url && (
              <div className="col-span-2">
                <span className="text-[var(--ink-300)] text-xs block">视频文件</span>
                <p className="text-[var(--ink-400)] text-xs mt-0.5 font-mono truncate">{video.url}</p>
              </div>
            )}
          </div>
        </div>
        <div className="border-[var(--ink-100)] flex gap-2 mt-5 pt-3 border-t">
          <button onClick={() => { onClose(); onEdit(video); }} className="btn btn-fox btn-sm">修改</button>
          <button onClick={() => { onClose(); onPreview(video); }} className="btn btn-outline btn-sm">▶ 播放</button>
          <button onClick={() => { onClose(); onLogs(video); }} className="btn btn-outline btn-sm">日志</button>
        </div>
      </div>
    </div>
  );
}

export function VideoPreviewModal({ video, onClose }: {
  video: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[var(--ink-900)] rounded-xl overflow-hidden w-full max-w-3xl"
        onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--ink-900)] flex items-center justify-between px-5 py-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-white truncate block">{video.name}</span>
            {video.description && (
              <span className="text-[var(--neutral-300)] text-xs mt-0.5 block">{video.description}</span>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white bg-transparent border-none cursor-pointer text-lg ml-3 flex-shrink-0">✕</button>
        </div>
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <video controls autoPlay style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <source src={`${window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''}/api/video-courses/${video.id}/stream?token=${encodeURIComponent(localStorage.getItem('token') || '')}`} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}

export function VideoLogModal({ videoName, logs, onClose }: {
  videoName: string;
  logs: any[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">📋 操作日志 — {videoName}</h3>
          <button onClick={onClose} className="text-sm bg-transparent border-none cursor-pointer text-[var(--ink-300)]" >✕</button>
        </div>
        {logs.length === 0 ? (
          <p className="text-[var(--ink-300)] py-8 text-center text-xs">暂无操作记录</p>
        ) : (
          <div className="relative pl-8">
            <div className="bg-[var(--ink-200)] absolute left-3.5 top-2 bottom-2 w-0.5" />
            {logs.map((log: any) => (
              <div key={log.id} className="relative pb-5">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 bg-[var(--paper)] border-[var(--fox)]"
                  />
                <div className="text-[var(--ink-300)] text-xs">
                  {new Date(log.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="text-sm mt-0.5">{log.action}</div>
                {log.operator && (
                  <div className="text-[var(--ink-400)] text-xs mt-0.5">操作人：{log.operator.displayName}</div>
                )}
                {log.detail && (
                  <div className="text-[var(--ink-400)] text-xs mt-0.5">{log.detail}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
