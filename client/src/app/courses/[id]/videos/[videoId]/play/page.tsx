'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const REPORT_INTERVAL = 30000;

export default function VideoPlayPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.id);
  const videoId = Number(params.videoId);

  const [video, setVideo] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  const playerRef = useRef<Plyr | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      api.courseVideos.get(courseId, videoId),
      api.courses.get(courseId),
      api.courseVideos.list(courseId),
      api.videoProgress.get(courseId, videoId).catch(() => null),
    ]).then(([videoData, courseData, videosData, progressData]) => {
      setVideo(videoData);
      setCourse(courseData);
      setVideos(videosData || []);
      setProgress(progressData);
      setCompleted(progressData?.completed || false);
    }).catch(() => router.push(`/courses/${courseId}`))
    .finally(() => setLoading(false));
  }, []);

  // Initialize Plyr player
  useEffect(() => {
    if (!video || !videoRef.current) return;
    const player = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
      resetOnEnd: false,
    });
    playerRef.current = player;

    // Restore playback position
    if (progress && progress.lastPosition > 0) {
      player.on('ready', () => {
        player.currentTime = progress.lastPosition;
      });
    }

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [video, progress]);

  // Progress reporting interval
  useEffect(() => {
    if (!video || !playerRef.current) return;
    // Wait for player to be ready
    const checkReady = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      // Plyr doesn't always report duration immediately
      if (p.duration > 0) {
        clearInterval(checkReady);
        startReporting();
      }
    }, 500);

    const startReporting = () => {
      const report = () => {
        const p = playerRef.current;
        if (!p || !p.duration) return;
        const pct = Math.min(100, Math.round((p.currentTime / p.duration) * 100));
        const isCompleted = pct >= (video.requiredPct || 80);
        if (isCompleted) setCompleted(true);
        api.videoProgress.report(courseId, videoId, {
          progress: pct,
          lastPosition: Math.round(p.currentTime),
          completed: isCompleted,
        }).catch(() => {});
      };

      intervalRef.current = setInterval(report, REPORT_INTERVAL);

      // Report on page close
      const handleBeforeUnload = () => {
        const p = playerRef.current;
        if (p && p.duration) {
          const pct = Math.min(100, Math.round((p.currentTime / p.duration) * 100));
          navigator.sendBeacon(
            `/api/courses/${courseId}/videos/${videoId}/progress`,
            JSON.stringify({
              progress: pct,
              lastPosition: Math.round(p.currentTime),
              completed: pct >= (video.requiredPct || 80),
            }),
          );
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    };

    return () => {
      clearInterval(checkReady);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [video, courseId, videoId]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!video) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push(`/courses/${courseId}`)} className="text-xs bg-transparent border-none cursor-pointer mb-3" style={{ color: 'var(--fox)' }}>
        ← {course?.name || '返回课程'}
      </button>

      {/* Video Player */}
      <div className="card p-0 overflow-hidden mb-4" style={{ maxWidth: 960 }}>
        <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
          <video
            ref={videoRef}
            id="video-player"
            className="plyr"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            controls
            playsInline
          >
            <source src={`/api/courses/${courseId}/videos/${videoId}/stream`} type="video/mp4" />
          </video>
        </div>
      </div>

      {/* Video Info */}
      <div className="card p-4 mb-6" style={{ maxWidth: 960 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">{video.title}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
              时长 {formatDuration(video.duration)} · 完成条件：需观看 {video.requiredPct}%
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
        {progress && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--ink-100)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress.progress || 0)}%`, background: 'var(--fox)', transition: 'width 0.3s' }} />
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--ink-400)' }}>{Math.round(progress.progress || 0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Other Videos */}
      {videos.length > 1 && (
        <div className="card p-0 overflow-hidden" style={{ maxWidth: 960 }}>
          <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--ink-200)' }}>播放列表（{videos.length}）</div>
          <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
            {videos.map((v: any) => (
              <div key={v.id} className={`flex items-center gap-3 px-5 py-2.5 ${v.id === videoId ? '' : 'cursor-pointer hover:bg-black/5'}`}
                style={v.id === videoId ? { background: 'var(--fox)', color: '#fff' } : {}}
                onClick={() => v.id !== videoId && router.push(`/courses/${courseId}/videos/${v.id}/play`)}>
                <span className="text-xs font-mono" style={{ opacity: 0.7 }}>{v.sortOrder || videos.indexOf(v) + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{v.title}</p>
                  <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>{formatDuration(v.duration)}</p>
                </div>
                {v.id === videoId && <span className="text-xs" style={{ opacity: 0.8 }}>正在播放</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
