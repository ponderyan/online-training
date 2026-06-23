'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api, API_STREAM_BASE } from '@/lib/api';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const REPORT_INTERVAL = 30000;

export default function LearningCenterPlayPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = Number(params.id);

  const [video, setVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  const playerRef = useRef<Plyr | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      api.videoCourses.get(videoId),
      api.videoCourses.getProgress(videoId).catch(() => null),
    ]).then(([videoData, progressData]) => {
      setVideo(videoData);
      setProgress(progressData);
      setCompleted(progressData?.completed || false);
    }).catch(() => router.push('/learning-center'))
    .finally(() => setLoading(false));
  }, []);

  // Initialize Plyr
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

    return () => { player.destroy(); playerRef.current = null; };
  }, [video, progress]);

  // Progress reporting
  useEffect(() => {
    if (!video || !playerRef.current) return;
    const checkReady = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.duration) return;
      clearInterval(checkReady);

      const report = () => {
        const p = playerRef.current;
        if (!p || !p.duration) return;
        const pct = Math.min(100, Math.round((p.currentTime / p.duration) * 100));
        const isCompleted = pct >= 80;
        if (isCompleted) setCompleted(true);
        api.videoCourses.reportProgress(videoId, {
          progress: pct, lastPosition: Math.round(p.currentTime), completed: isCompleted,
        }).catch(() => {});
      };

      intervalRef.current = setInterval(report, REPORT_INTERVAL);

      const handleBeforeUnload = () => {
        const p = playerRef.current;
        if (p && p.duration) {
          const pct = Math.min(100, Math.round((p.currentTime / p.duration) * 100));
          navigator.sendBeacon(`/api/video-courses/${videoId}/progress`, JSON.stringify({
            progress: pct, lastPosition: Math.round(p.currentTime),
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
  }, [video, videoId]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>;
  if (!video) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/learning-center')} className="text-xs bg-transparent border-none cursor-pointer mb-3" style={{ color: 'var(--fox)' }}>
        ← 返回学习中心
      </button>

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
          </div>
          <div>
            {completed ? (
              <span className="tag" style={{ background: '#2e7d3218', color: '#2e7d32', fontWeight: 600 }}>✅ 已完成</span>
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
      </div>
    </AppLayout>
  );
}
