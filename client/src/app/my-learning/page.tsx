'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

interface MyLearningData {
  examStats: {
    totalAttempts: number;
    passed: number;
    failed: number;
    pendingScore: number;
    avgScore: number;
    recentExams: {
      examId: number;
      examTitle: string;
      paperName: string;
      totalScore: number;
      myScore: number | null;
      isPassed: boolean | null;
      scoringStatus: string | null;
      submittedAt: string | null;
    }[];
  };
  hoursStats: {
    totalHours: number;
    approvedHours: number;
    pendingHours: number;
    rejectedHours: number;
    recentRecords: {
      id: number;
      programName: string;
      source: string;
      hours: number;
      typeName: string | null;
      status: string;
      recordedAt: string;
    }[];
  };
  certificates: {
    total: number;
    items: {
      id: number;
      certificateNo: string;
      courseName: string;
      issueDate: string;
    }[];
  };
}

export default function MyLearningPage() {
  const router = useRouter();
  const [data, setData] = useState<MyLearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [learningPath, setLearningPath] = useState<any[] | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const LEVEL_COLORS: Record<string, string> = {
    '优秀': 'var(--sage)',
    '良好': 'var(--sage)',
    '一般': 'var(--warning)',
    '薄弱': 'var(--error)',
    '危险': 'var(--error)',
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/student/my-learning', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/student/recommendations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.learningPath?.length > 0) {
          setLearningPath(data.learningPath);
        }
      })
      .catch(() => {});
  }, []);

  // Track step completion via localStorage
  useEffect(() => {
    if (learningPath) {
      const completed = new Set<number>();
      learningPath.forEach((step: any) => {
        const val = localStorage.getItem(`learning-path-completed-${step.kpId}`);
        if (val === 'true') completed.add(step.kpId);
      });
      setCompletedSteps(completed);
    }
  }, [learningPath]);

  const toggleComplete = (kpId: number) => {
    const key = `learning-path-completed-${kpId}`;
    const current = localStorage.getItem(key) === 'true';
    if (current) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, 'true');
    }
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (current) next.delete(kpId); else next.add(kpId);
      return next;
    });
  };

  const statusBadge = (status: string | null) => {
    if (status === 'PUBLISHED' || status === 'ADJUSTED') {
      return <span className="text-xs" style={{ fontWeight: 600, color: 'var(--sage)' }}>已发布</span>;
    }
    if (status === 'GRADED') {
      return <span className="text-xs" style={{ fontWeight: 600, color: 'var(--fox)' }}>已评分</span>;
    }
    if (status === 'GRADING') {
      return <span className="text-xs" style={{ fontWeight: 600, color: 'var(--fox-light)' }}>评分中</span>;
    }
    return <span className="text-xs" style={{ fontWeight: 600, color: 'var(--ink-300)' }}>待评分</span>;
  };

  const hourStatusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="text-[var(--sage)] text-xs">✅ 已审核</span>;
    if (status === 'REJECTED') return <span className="text-[var(--error)] text-xs">❌ 已驳回</span>;
    return <span className="text-[var(--fox)] text-xs">⏳ 待审核</span>;
  };

  // Learning path computation
  const firstUncompletedIdx = (learningPath || []).findIndex(
    (s: any) => !completedSteps.has(s.kpId)
  );
  const allDone = (learningPath?.length ?? 0) > 0 && firstUncompletedIdx === -1;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="page-title">📚 我的学习</h1>
          <p className="page-subtitle">学习进度总览 · 考试 · 学时 · 证书</p>
        </div>

        {/* ──────── 顶部统计卡片 ──────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* 考试通过率 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                📋
              </div>
              <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
                考试通过率
              </span>
            </div>
            <div className="text-[var(--ink-700)] text-3xl font-bold">
              {(data?.examStats.totalAttempts ?? 0) > 0
                ? Math.round(((data?.examStats.passed ?? 0) / (data?.examStats.totalAttempts ?? 1)) * 100)
                : 0}%
            </div>
            <div className="text-[var(--ink-400)] flex gap-3 mt-2 text-xs">
              <span>通过 <strong className="text-[var(--sage)]">{data?.examStats.passed || 0}</strong></span>
              <span>未通过 <strong className="text-[var(--error)]">{data?.examStats.failed || 0}</strong></span>
              <span>待评分 <strong className="text-[var(--fox)]">{data?.examStats.pendingScore || 0}</strong></span>
            </div>
          </div>

          {/* 总学时 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                🕐
              </div>
              <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
                总学时
              </span>
            </div>
            <div className="text-[var(--ink-700)] text-3xl font-bold">
              {data?.hoursStats.totalHours || 0}
              <span className="text-[var(--ink-400)] text-base font-normal"> h</span>
            </div>
            <div className="text-[var(--ink-400)] flex gap-3 mt-2 text-xs">
              <span>已审核 <strong className="text-[var(--sage)]">{data?.hoursStats.approvedHours || 0}</strong></span>
              <span>待审核 <strong className="text-[var(--fox)]">{data?.hoursStats.pendingHours || 0}</strong></span>
            </div>
          </div>

          {/* 证书数 */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[var(--fox-pale)] w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                🏅
              </div>
              <span className="text-[var(--ink-400)] text-xs uppercase tracking-wider">
                证书数
              </span>
            </div>
            <div className="text-[var(--ink-700)] text-3xl font-bold">
              {data?.certificates.total || 0}
            </div>
            <div className="mt-2">
              <button onClick={() => router.push('/my-certificates')}
                className="text-xs" style={{ color: 'var(--fox)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                查看全部证书 →
              </button>
            </div>
          </div>
        </div>

        {/* ──────── 中间区域：最近考试 + 最近学时 ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 最近考试 */}
          <div className="card p-5">
            <h2 className="text-[var(--ink-700)] font-bold text-sm mb-4">
              📋 最近考试
            </h2>
            {data?.examStats.recentExams.length === 0 ? (
              <div className="text-[var(--ink-300)] text-center py-8">
                <div className="text-2xl mb-2">📝</div>
                <p className="text-xs">还没有参加过考试</p>
                <button onClick={() => router.push('/exam')}
                  className="btn btn-fox btn-sm mt-3">去看看</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--ink-400)]">
                      <th className="text-left pb-2 font-medium">考试</th>
                      <th className="text-left pb-2 font-medium">分数</th>
                      <th className="text-left pb-2 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.examStats.recentExams.map((exam, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'rgba(139,129,116,0.12)' }}>
                        <td className="py-2.5 pr-2">
                          <div className="text-[var(--ink-700)] font-medium">
                            {exam.examTitle}
                          </div>
                          <div className="text-[var(--ink-300)]">{exam.paperName}</div>
                        </td>
                        <td className="text-[var(--ink-600)] py-2.5 pr-2">
                          {exam.myScore != null
                            ? `${exam.myScore}/${exam.totalScore}`
                            : '—'}
                        </td>
                        <td className="py-2.5">
                          {statusBadge(exam.scoringStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(data?.examStats.recentExams.length ?? 0) > 0 && (
              <div className="mt-3 text-right">
                <button onClick={() => router.push('/exam/results')}
                  className="text-xs" style={{ color: 'var(--fox)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                  查看全部成绩 →
                </button>
              </div>
            )}
          </div>

          {/* 最近学时 */}
          <div className="card p-5">
            <h2 className="text-[var(--ink-700)] font-bold text-sm mb-4">
              🕐 最近学时记录
            </h2>
            {data?.hoursStats.recentRecords.length === 0 ? (
              <div className="text-[var(--ink-300)] text-center py-8">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-xs">还没有学时记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.hoursStats.recentRecords.map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between py-1.5 border-b"
                    style={{ borderColor: 'rgba(139,129,116,0.08)' }}>
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="text-[var(--ink-700)] text-xs font-medium truncate">
                        {rec.programName}
                      </div>
                      <div className="text-[var(--ink-400)] text-xs mt-0.5">
                        {rec.source === 'VIDEO' ? '📺 视频' : '✏️ 申报'}
                        {rec.typeName ? ` · ${rec.typeName}` : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[var(--ink-700)] text-sm font-semibold">
                        {rec.hours}h
                      </div>
                      <div className="mt-0.5">{hourStatusBadge(rec.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(data?.hoursStats.recentRecords.length ?? 0) > 0 && (
              <div className="mt-3 text-right">
                <button onClick={() => router.push('/learning-hours')}
                  className="text-xs" style={{ color: 'var(--fox)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                  查看全部学时 →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ──────── 底部：证书展示 ──────── */}
        <div className="card p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[var(--ink-700)] font-bold text-sm">
              🏅 我的证书（{data?.certificates.total || 0}）
            </h2>
            {(data?.certificates.total ?? 0) > 0 && (
              <button onClick={() => router.push('/my-certificates')}
                className="btn btn-fox btn-sm">查看全部</button>
            )}
          </div>
          {data?.certificates.items.length === 0 ? (
            <div className="text-[var(--ink-300)] text-center py-8">
              <div className="text-2xl mb-2">🎓</div>
              <p className="text-xs">还没有获得证书</p>
              <p className="text-[var(--ink-300)] text-xs mt-1">
                参加考试并通过后自动发放
              </p>
              <button onClick={() => router.push('/exam')}
                className="btn btn-fox btn-sm mt-3">去看看考试</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data?.certificates.items.slice(0, 6).map((cert) => (
                <div key={cert.id} className="p-3 rounded-xl flex items-start gap-3"
                  style={{ background: 'rgba(232, 122, 48, 0.05)' }}>
                  <span className="text-lg flex-shrink-0 mt-0.5">🏅</span>
                  <div className="min-w-0">
                    <div className="text-[var(--ink-700)] text-xs font-semibold truncate">
                      {cert.courseName}
                    </div>
                    <div className="text-[var(--ink-400)] text-xs mt-1">
                      {cert.certificateNo}
                    </div>
                    <div className="text-[var(--ink-300)] text-xs">
                      {new Date(cert.issueDate).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ 学习路径 ═══ */}
        {learningPath && learningPath.length > 0 && (
          <div className="card p-5 mb-8">
            <h2 className="text-[var(--ink-700)] font-bold text-sm mb-4">
              📋 你的专属学习路径
            </h2>

            {allDone ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🎉</div>
                <p className="text-[var(--ink-700)] text-sm font-medium">恭喜！你已完成所有推荐课程</p>
              </div>
            ) : (
              <div className="space-y-3">
                {learningPath.map((step: any, idx: number) => {
                  const isCompleted = completedSteps.has(step.kpId);
                  const isCurrent = idx === firstUncompletedIdx;

                  return (
                    <div key={step.kpId} className={`p-4 rounded-xl ${isCurrent ? 'border-2' : 'border'}`} style={{
                      borderColor: isCurrent ? 'var(--fox)' : 'var(--ink-100)',
                      background: isCurrent ? 'var(--fox-pale)' : 'white',
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        {isCurrent && <span className="text-sm">➡️</span>}
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: isCompleted ? 'var(--sage-glow)' : isCurrent ? 'var(--fox)' : 'var(--ink-100)',
                            color: isCompleted ? 'var(--sage)' : isCurrent ? 'white' : 'var(--ink-400)',
                          }}>
                          {isCompleted ? '✅' : idx + 1}
                        </span>
                        <span className="text-[var(--ink-700)] text-xs font-medium truncate">{step.kpName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{
                          background: `color-mix(in srgb, ${(LEVEL_COLORS[step.level] || 'var(--warning)')} 10%, transparent)`,
                          color: LEVEL_COLORS[step.level] || 'var(--warning)',
                        }}>
                          {step.level}
                        </span>
                        <span className="text-[var(--ink-300)] text-[10px] flex-shrink-0">
                          {step.avgRate}% 掌握
                        </span>
                        {!isCompleted && (
                          <button onClick={() => toggleComplete(step.kpId)}
                            className="text-[10px] px-2 py-0.5 rounded border-none cursor-pointer ml-auto flex-shrink-0"
                            style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
                            标记完成
                          </button>
                        )}
                      </div>
                      {step.courses?.length > 0 && (
                        <div className="ml-9 space-y-1">
                          {step.courses.map((course: any) => (
                            <div key={course.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs"
                              style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[var(--ink-600)] truncate">{course.title}</span>
                                {course.duration != null && (
                                  <span className="text-[var(--ink-300)] flex-shrink-0">{course.duration}分钟</span>
                                )}
                              </div>
                              <button onClick={() => router.push(`/video/${course.id}`)}
                                className="text-xs px-2.5 py-1 rounded-md border-none cursor-pointer font-medium flex-shrink-0 ml-2"
                                style={{ background: 'var(--fox)', color: 'white' }}>
                                去学习
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
