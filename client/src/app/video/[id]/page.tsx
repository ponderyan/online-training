'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, API_STREAM_BASE } from '@/lib/api';

const mediaURL = (path: string) =>
  process.env.NODE_ENV === 'production' ? path : `http://localhost:3001${path}`;

export default function VideoPlayPage() {
  const { id } = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [videoData, progressData, visibleData] = await Promise.all([
          api.videoCourses.get(Number(id)),
          api.videoCourses.getProgress(Number(id)).catch(() => null),
          api.videoCourses.getStudentVisible().catch(() => ({ videos: [], stats: {} })),
        ]);
        setVideo(videoData);
        setProgress(progressData);
        setRelatedVideos(
          (visibleData.videos || []).filter((v: any) => v.id !== Number(id)).slice(0, 5)
        );
      } catch (e: any) {
        setError(e.message || '无法加载视频');
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!progress || !videoRef.current) return;
    if (progress.lastPosition > 0) {
      videoRef.current.currentTime = progress.lastPosition;
    }
  }, [progress]);

  const fmtDuration = (sec: number) => {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0f0f0f', color: '#888' }}>加载中… 🦊</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0f0f0f', color: '#888' }}>{error}</div>;
  if (!video) return null;

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: '#eee' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <button onClick={() => router.push('/learning-center')} style={{ background: 'none', border: 'none', color: '#e87a30', cursor: 'pointer', fontSize: 13 }}>
          ← 返回
        </button>
        <span style={{ fontSize: 12, color: '#666' }}>🦊 狐学</span>
      </div>

      <div className="flex" style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Left — Player */}
        <div className="flex-1 p-4">
          <div className="rounded-lg overflow-hidden" style={{ background: '#000' }}>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <video ref={videoRef} controls autoPlay playsInline
                poster={video.coverUrl ? mediaURL(video.coverUrl) : undefined}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                <source src={`${API_STREAM_BASE}/api/video-courses/${id}/stream?token=${typeof window !== 'undefined' ? encodeURIComponent(localStorage.getItem('token') || '') : ''}`} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>

        {/* Right — Info panel */}
        <div className="w-80 p-4 overflow-y-auto" style={{ borderLeft: '1px solid #333', maxHeight: 'calc(100vh - 56px)' }}>
          {/* Video info */}
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-2">{video.name}</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{
                background: video.type === 'PUBLIC' ? 'rgba(0,137,123,0.2)' : 'rgba(21,101,192,0.2)',
                color: video.type === 'PUBLIC' ? '#4db6ac' : '#64b5f6',
              }}>{video.type === 'PUBLIC' ? '公共课' : '专项课'}</span>
              {video.isContinuingEducation && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(46,125,50,0.2)', color: '#81c784' }}>继续教育</span>
              )}
            </div>
            <div className="text-xs space-y-1" style={{ color: '#999' }}>
              {video.instructorName && <p>👤 {video.instructorName}{video.instructorLevel ? `（${video.instructorLevel}）` : ''}</p>}
              {video.hours && <p>⏱ {video.hours} 课时 {video.duration ? `· ${fmtDuration(video.duration)}` : ''}</p>}
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-2" style={{ color: '#999' }}>📝 简介</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#aaa' }}>{video.description}</p>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-2" style={{ color: '#999' }}>📊 学习进度</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#333' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, progress.progress || 0)}%`,
                    background: progress.completed ? '#4caf50' : '#e87a30',
                  }} />
                </div>
                <span className="text-xs font-mono" style={{ color: progress.completed ? '#4caf50' : '#e87a30' }}>
                  {Math.round(progress.progress || 0)}%
                </span>
              </div>
              {progress.completed && <p className="text-xs mt-1" style={{ color: '#4caf50' }}>🎉 已完成</p>}
            </div>
          )}

          {/* Related videos */}
          {relatedVideos.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-3" style={{ color: '#999' }}>▶ 相关视频</h3>
              <div className="space-y-2">
                {relatedVideos.map((rv: any) => {
                  const rpct = rv.progress ? Math.min(100, Math.round(rv.progress.progress || 0)) : 0;
                  return (
                    <div key={rv.id}
                      onClick={() => router.push(`/video/${rv.id}`)}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors"
                      style={{ background: Number(id) === rv.id ? '#333' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                      onMouseLeave={e => e.currentTarget.style.background = Number(id) === rv.id ? '#333' : 'transparent'}>
                      {rv.coverUrl ? (
                        <img src={mediaURL(rv.coverUrl)} alt="" className="rounded flex-shrink-0" style={{ width: 40, height: 27, objectFit: 'cover' }} />
                      ) : (
                        <div className="rounded flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 27, background: '#333', fontSize: 12 }}>🎬</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{rv.name}</p>
                        {rpct > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 h-1 rounded-full" style={{ background: '#444' }}>
                              <div className="h-full rounded-full" style={{ width: `${rpct}%`, background: rpct >= 80 ? '#4caf50' : '#e87a30' }} />
                            </div>
                            <span className="text-[10px]" style={{ color: '#666' }}>{rpct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
