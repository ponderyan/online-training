'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, API_STREAM_BASE } from '@/lib/api';

const mediaURL = (path: string) =>
  process.env.NODE_ENV === 'production' ? path : `http://localhost:3001${path}`;

const REPORT_INTERVAL = 15000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayPage() {
  const { id } = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [video, setVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [seekBlocked, setSeekBlocked] = useState(false);
  const [idlePaused, setIdlePaused] = useState(false);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizWrong, setQuizWrong] = useState(false);
  const answeredQuizzes = useRef<Set<number>>(new Set());

  // ── 加载数据 ──
  useEffect(() => {
    (async () => {
      try {
        const [videoData, progressData, visibleData, quizData] = await Promise.all([
          api.videoCourses.get(Number(id)),
          api.videoCourses.getProgress(Number(id)).catch(() => null),
          api.videoCourses.getStudentVisible().catch(() => ({ videos: [], stats: {} })),
          api.videoCourses.getQuizzes(Number(id)).catch(() => []),
        ]);
        setQuizzes(quizData || []);
        setVideo(videoData);
        setProgress(progressData);
        setRelatedVideos((visibleData.videos || []).filter((v: any) => v.id !== Number(id)).slice(0, 5));
      } catch (e: any) {
        setError(e.message || '无法加载视频');
      }
      setLoading(false);
    })();
  }, [id]);

  // ── 断点续播 ──
  useEffect(() => {
    if (!progress || !videoRef.current) return;
    if (progress.lastPosition > 0) {
      videoRef.current.currentTime = progress.lastPosition;
      maxWatchedRef.current = progress.lastPosition;
    }
  }, [progress]);

  // ── 进度上报 ──
  const reportProgress = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration || el.paused) return;
    const pct = Math.min(100, Math.round((el.currentTime / el.duration) * 100));
    const isCompleted = pct >= (video?.requiredPct || 80);
    api.videoCourses.reportProgress(Number(id), {
      progress: pct,
      lastPosition: Math.round(el.currentTime),
      completed: isCompleted,
    }).then(res => { if (res) setProgress(res); }).catch(() => {});
  }, [id, video]);

  useEffect(() => {
    if (!video) return;
    const timer = setInterval(reportProgress, REPORT_INTERVAL);

    const handleBeforeUnload = () => {
      const el = videoRef.current;
      if (!el || !el.duration) return;
      const pct = Math.min(100, Math.round((el.currentTime / el.duration) * 100));
      const token = localStorage.getItem('token') || '';
      const blob = new Blob(
        [JSON.stringify({ progress: pct, lastPosition: Math.round(el.currentTime), completed: pct >= (video?.requiredPct || 80) })],
        { type: 'application/json' },
      );
      navigator.sendBeacon(`${API_STREAM_BASE}/api/video-courses/${id}/progress?token=${encodeURIComponent(token)}`, blob);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleVisibility = () => { if (document.hidden) reportProgress(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [video, id, reportProgress]);

  // ── P2-2: 防拖拽 ──
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    const isCompleted = progress?.completed;

    const handleSeeking = () => {
      if (isCompleted) return;
      if (el.currentTime > maxWatchedRef.current + 3) {
        el.currentTime = maxWatchedRef.current;
        setSeekBlocked(true);
        setTimeout(() => setSeekBlocked(false), 2000);
      }
    };
    const handleTimeUpdate = () => {
      if (el.currentTime > maxWatchedRef.current) maxWatchedRef.current = el.currentTime;
    };

    el.addEventListener('seeking', handleSeeking);
    el.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      el.removeEventListener('seeking', handleSeeking);
      el.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [video, progress?.completed]);

  // ── P3-1: 弹题验证 ──
  useEffect(() => {
    const el = videoRef.current;
    if (!el || quizzes.length === 0) return;

    const checkQuiz = () => {
      if (activeQuiz) return;
      const t = Math.floor(el.currentTime);
      const quiz = quizzes.find(q => Math.abs(q.timePoint - t) <= 1 && !answeredQuizzes.current.has(q.id));
      if (quiz) {
        el.pause();
        setActiveQuiz(quiz);
        setQuizAnswer(null);
        setQuizWrong(false);
      }
    };

    el.addEventListener('timeupdate', checkQuiz);
    return () => el.removeEventListener('timeupdate', checkQuiz);
  }, [quizzes, activeQuiz]);

  const handleQuizSubmit = (idx: number) => {
    if (!activeQuiz) return;
    setQuizAnswer(idx);
    if (idx === activeQuiz.correctIndex) {
      answeredQuizzes.current.add(activeQuiz.id);
      setTimeout(() => {
        setActiveQuiz(null);
        videoRef.current?.play();
      }, 600);
    } else {
      setQuizWrong(true);
    }
  };

  // ── P2-3: 防切屏 + 防挂机 ──
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;

    const handleVis = () => { if (document.hidden && !el.paused) el.pause(); };
    document.addEventListener('visibilitychange', handleVis);

    const resetIdle = () => {
      setIdlePaused(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!el.paused) { el.pause(); setIdlePaused(true); }
      }, 5 * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(evt => document.addEventListener(evt, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      events.forEach(evt => document.removeEventListener(evt, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [video]);

  // ── 倍速 ──
  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

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
        <button onClick={() => router.push('/video')} style={{ background: 'none', border: 'none', color: '#e87a30', cursor: 'pointer', fontSize: 13 }}>← 返回</button>
        <span style={{ fontSize: 12, color: '#666' }}>🦊 狐学</span>
      </div>

      <div className="flex" style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Left: Player */}
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

          {/* 弹题覆盖层 */}
          {activeQuiz && (
            <div className="mt-3 p-4 rounded-lg" style={{ background: '#1e1e1e', border: '1px solid #444' }}>
              <p className="text-sm font-medium mb-3" style={{ color: '#fff' }}>📋 {activeQuiz.question}</p>
              <div className="space-y-2">
                {(JSON.parse(activeQuiz.options) as string[]).map((opt, idx) => (
                  <button key={idx} onClick={() => handleQuizSubmit(idx)}
                    className="block w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: quizAnswer === idx ? (idx === activeQuiz.correctIndex ? '#2e7d32' : '#c62828') : '#2a2a2a',
                      color: '#eee', border: '1px solid #444', cursor: 'pointer',
                    }}>
                    {String.fromCharCode(65 + idx)}. {opt}
                  </button>
                ))}
              </div>
              {quizWrong && <p className="text-xs mt-2" style={{ color: '#ff9800' }}>❌ 回答错误，请重新选择</p>}
            </div>
          )}

          {/* 倍速控制条 */}
          <div className="flex items-center gap-2 mt-2 px-1 flex-wrap">
            <span className="text-xs" style={{ color: '#888' }}>倍速</span>
            {SPEEDS.map(rate => (
              <button key={rate} onClick={() => changeRate(rate)}
                className="px-2 py-0.5 rounded text-xs transition-colors"
                style={{ background: playbackRate === rate ? '#e87a30' : '#2a2a2a', color: playbackRate === rate ? '#fff' : '#999', border: 'none', cursor: 'pointer' }}>
                {rate}x
              </button>
            ))}
            {seekBlocked && <span className="text-xs ml-3" style={{ color: '#ff9800' }}>⚠ 首次观看不可快进</span>}
            {idlePaused && <span className="text-xs ml-3" style={{ color: '#ff9800' }}>⏸ 长时间无操作已暂停</span>}
          </div>
        </div>

        {/* Right: Info panel */}
        <div className="w-80 p-4 overflow-y-auto" style={{ borderLeft: '1px solid #333', maxHeight: 'calc(100vh - 56px)' }}>
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-2">{video.name}</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: video.type === 'PUBLIC' ? 'rgba(0,137,123,0.2)' : 'rgba(21,101,192,0.2)', color: video.type === 'PUBLIC' ? '#4db6ac' : '#64b5f6' }}>
                {video.type === 'PUBLIC' ? '公共课' : '专项课'}
              </span>
              {video.isContinuingEducation && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(46,125,50,0.2)', color: '#81c784' }}>继续教育</span>
              )}
            </div>
            <div className="text-xs space-y-1" style={{ color: '#999' }}>
              {video.instructorName && <p>👤 {video.instructorName}{video.instructorLevel ? `（${video.instructorLevel}）` : ''}</p>}
              {video.hours && <p>⏱ {video.hours} 课时 {video.duration ? `· ${fmtDuration(video.duration)}` : ''}</p>}
            </div>
          </div>

          {video.description && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-2" style={{ color: '#999' }}>📝 简介</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#aaa' }}>{video.description}</p>
            </div>
          )}

          {progress && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-2" style={{ color: '#999' }}>📊 学习进度</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#333' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress.progress || 0)}%`, background: progress.completed ? '#4caf50' : '#e87a30' }} />
                </div>
                <span className="text-xs font-mono" style={{ color: progress.completed ? '#4caf50' : '#e87a30' }}>{Math.round(progress.progress || 0)}%</span>
              </div>
              {progress.completed && <p className="text-xs mt-1" style={{ color: '#4caf50' }}>🎉 已完成</p>}
            </div>
          )}

          {relatedVideos.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-3" style={{ color: '#999' }}>▶ 相关视频</h3>
              <div className="space-y-2">
                {relatedVideos.map((rv: any) => {
                  const rpct = rv.progress ? Math.min(100, Math.round(rv.progress.progress || 0)) : 0;
                  return (
                    <div key={rv.id} onClick={() => router.push(`/video/${rv.id}`)}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
