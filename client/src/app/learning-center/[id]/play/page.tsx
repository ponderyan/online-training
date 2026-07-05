'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api, API_STREAM_BASE } from '@/lib/api';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const REPORT_INTERVAL = 60000;

export default function LearningCenterPlayPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = Number(params.id);

  const [video, setVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const playerRef = useRef<Plyr | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      api.videoCourses.get(videoId),
      api.videoCourses.getProgress(videoId).catch(() => null),
      api.videoCourses.getStudentVisible().catch(() => null),
    ]).then(([videoData, progressData, visibleData]) => {
      setVideo(videoData);
      setProgress(progressData);
      setCompleted(progressData?.completed || false);
      setAllVideos(visibleData?.videos || []);
    }).catch(() => router.push('/learning-center'))
    .finally(() => setLoading(false));
  }, []);

  // Initialize Plyr + anti-cheating
  useEffect(() => {
    if (!video || !videoRef.current) return;
    const player = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
      resetOnEnd: false,
    });
    playerRef.current = player;

    if (progress && progress.lastPosition > 0) {
      player.on('ready', () => { player.currentTime = progress.lastPosition; });
    }

    // C1b: Seek restriction — can't jump to >95% if under 30% progress
    const prevPct = progress ? (progress.progress || 0) : 0;
    player.on('seeking', () => {
      if (!player.duration) return;
      const targetPct = (player.currentTime / player.duration) * 100;
      if (targetPct > 95 && prevPct < 30) {
        player.currentTime = player.duration * 0.3;
      }
    });

    // C1a: Visibility change — auto pause on blur
    const handleVisibility = () => { if (document.hidden && player) player.pause(); };
    const handleBlur = () => { if (player) player.pause(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      player.destroy();
      playerRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [video, progress]);

  // Progress reporting (60s interval + event-driven)
  const reportProgress = useCallback(() => {
    const p = playerRef.current;
    if (!p || !p.duration) return;
    const pct = Math.min(100, Math.round((p.currentTime / p.duration) * 100));
    const isCompleted = pct >= 80;
    if (isCompleted) setCompleted(true);
    api.videoCourses.reportProgress(videoId, {
      progress: pct, lastPosition: Math.round(p.currentTime), completed: isCompleted,
    }).catch(() => {});
  }, [videoId]);

  useEffect(() => {
    if (!video || !playerRef.current) return;
    const checkReady = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.duration) return;
      clearInterval(checkReady);

      intervalRef.current = setInterval(reportProgress, REPORT_INTERVAL);

      // Event-driven reporting
      p.on('pause', reportProgress);
      p.on('seeked', reportProgress);
      p.on('ended', reportProgress);

      const handleBeforeUnload = () => {
        const p2 = playerRef.current;
        if (p2 && p2.duration) {
          const pct = Math.min(100, Math.round((p2.currentTime / p2.duration) * 100));
          navigator.sendBeacon(`/api/video-courses/${videoId}/progress`, JSON.stringify({
            progress: pct, lastPosition: Math.round(p2.currentTime),
            completed: pct >= 80,
          }));
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, 500);

    return () => clearInterval(checkReady);
  }, [video, videoId, reportProgress]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;
  if (!video) return null;

  return (
    <AppLayout>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => router.push('/learning-center')} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
          ← 返回学习中心
        </button>
        {allVideos.length > 0 && (
          <button onClick={() => setShowSidebar(!showSidebar)}
            className="ml-auto btn btn-outline btn-xs">
            📋 {showSidebar ? '收起列表' : '课程列表'}
          </button>
        )}
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="card p-0 overflow-hidden mb-4" style={{ maxWidth: 960 }}>
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
              <video ref={videoRef} className="plyr"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                controls playsInline>
                <source src={`${API_STREAM_BASE}/api/video-courses/${videoId}/stream`} type="video/mp4" />
              </video>
            </div>
          </div>

          <div className="card p-4 mb-6" style={{ maxWidth: 960 }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">{video.name}</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                  {video.instructorName && `${video.instructorName}${video.instructorLevel ? ` (${video.instructorLevel})` : ''}`}
                  {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
                  {video.hours ? ` · ${video.hours} 课时` : ''}
                  {video.isContinuingEducation && ' · 计入学时'}
                </p>
                {/* 关联课程/培训班信息 */}
                {video.courseLinks?.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>
                    📎 关联课程：{video.courseLinks.map((cl: any) => cl.course?.name).filter(Boolean).join('、')}
                  </p>
                )}
              </div>
              <div>
                {completed ? (
                  <span className="tag" style={{ background: '#2e7d3218', color: '#2e7d32', fontWeight: 600 }}>🎉 已完成</span>
                ) : (
                  <span className="tag" style={{ background: '#e87a3018', color: '#e87a30' }}>学习中</span>
                )}
              </div>
            </div>
            {video.description && (
              <p className="text-sm mt-3" style={{ color: 'var(--ink-400)' }}>{video.description}</p>
            )}
            {progress && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, progress.progress || 0)}%`,
                      background: completed ? '#2e7d32' : 'var(--fox)',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--ink-400)' }}>{Math.round(progress.progress || 0)}%</span>
                </div>
              </div>
            )}
            {completed && (
              <div className="mt-4 p-3 rounded-lg text-center animate-fadeSlide" style={{ background: '#f0faf0', border: '1px solid #c8e6c9' }}>
                <span className="text-lg">🎉 恭喜完成本视频学习！</span>
              </div>
            )}
          </div>
        </div>

        {/* Desktop sidebar */}
        {showSidebar && allVideos.length > 0 && (
          <aside className="w-[240px] flex-shrink-0 hidden lg:block">
            <div className="sticky top-24 card p-3 max-h-[calc(100vh-120px)] overflow-y-auto">
              <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--ink-500)' }}>课程列表</h3>
              <div className="space-y-0.5">
                {allVideos.map((v: any) => {
                  const isCurrent = v.id === videoId;
                  const vPct = v.progress ? Math.min(100, Math.round(v.progress.progress || 0)) : 0;
                  const vDone = v.progress?.completed || false;
                  let icon = '•';
                  let iconColor = 'var(--ink-300)';
                  if (vDone) { icon = '✅'; iconColor = '#2e7d32'; }
                  else if (isCurrent) { icon = '▶️'; iconColor = 'var(--fox)'; }
                  else if (vPct > 0) { icon = '⏳'; iconColor = '#e87a30'; }
                  return (
                    <div key={v.id} onClick={() => !isCurrent && router.push(`/learning-center/${v.id}/play`)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${isCurrent ? 'font-bold' : 'cursor-pointer hover:bg-[var(--fox-glow)]'}`}
                      style={{
                        background: isCurrent ? 'var(--fox-glow)' : 'transparent',
                        color: isCurrent ? 'var(--fox)' : 'var(--ink-600)',
                      }}>
                      <span style={{ color: iconColor, flexShrink: 0 }}>{icon}</span>
                      <span className="truncate">{v.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile sidebar (below video when toggled) */}
      {showSidebar && allVideos.length > 0 && (
        <div className="lg:hidden card p-3 mb-6">
          <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--ink-500)' }}>课程列表</h3>
          <div className="space-y-0.5">
            {allVideos.map((v: any) => {
              const isCurrent = v.id === videoId;
              const vPct = v.progress ? Math.min(100, Math.round(v.progress.progress || 0)) : 0;
              const vDone = v.progress?.completed || false;
              let icon = '•';
              let iconColor = 'var(--ink-300)';
              if (vDone) { icon = '✅'; iconColor = '#2e7d32'; }
              else if (isCurrent) { icon = '▶️'; iconColor = 'var(--fox)'; }
              else if (vPct > 0) { icon = '⏳'; iconColor = '#e87a30'; }
              return (
                <div key={v.id} onClick={() => !isCurrent && router.push(`/learning-center/${v.id}/play`)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${isCurrent ? 'font-bold' : 'cursor-pointer hover:bg-[var(--fox-glow)]'}`}
                  style={{
                    background: isCurrent ? 'var(--fox-glow)' : 'transparent',
                    color: isCurrent ? 'var(--fox)' : 'var(--ink-600)',
                  }}>
                  <span style={{ color: iconColor, flexShrink: 0 }}>{icon}</span>
                  <span className="truncate">{v.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
