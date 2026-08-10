'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import ErrorCard from '@/components/ErrorCard';
import Loading from '@/components/Loading';
import type { LearningReport } from './components/report-types';
import { ProfileSummaryCard, SummaryCards } from './components/summary-cards';
import { PracticeTrendCard } from './components/practice-trend-card';
import { KpMasteryCard } from './components/kp-mastery-card';
import { HoursWeakCard } from './components/hours-weak-card';
import { ActivityCard } from './components/activity-card';
import { ProgramProgressCard } from './components/program-progress-card';

// ── 主页面（D 拆分后仅保留数据加载与组合，区块见 components/）──
export default function LearningReportPage() {
  const router = useRouter();
  const [data, setData] = useState<LearningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceTrend, setPracticeTrend] = useState<any[]>([]);
  const [activeKps, setActiveKps] = useState<string[]>([]);
  const [topKps, setTopKps] = useState<string[]>([]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const res = await fetch('/api/student/exams/learning-report', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error(`加载失败 (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      const trendRes = await fetch('/api/questions/practice/trend?days=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setPracticeTrend(trendData);
        // Extract top 5 KPs by total practice count
        const kpCounts: Record<string, number> = {};
        trendData.forEach((d: any) => {
          if (d.kpBreakdown) {
            Object.entries(d.kpBreakdown).forEach(([kp, stats]: [string, any]) => {
              kpCounts[kp] = (kpCounts[kp] || 0) + (stats.totalQuestions || 0);
            });
          }
        });
        const sorted = Object.entries(kpCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([kp]) => kp);
        setTopKps(sorted);
        setActiveKps(sorted);
      }
    } catch (e: any) {
      setError(e.message || '加载学习报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // ── Loading ──
  if (loading) {
    return (
      <AppLayout>
        <Loading text="小狐狸正在加载学习报告…" />
      </AppLayout>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <AppLayout>
        <div className="card"><ErrorCard message={error} onRetry={loadReport} /></div>
      </AppLayout>
    );
  }

  const summary = data?.summary;
  const kpMastery = data?.kpMastery || [];
  const hoursDist = data?.hoursDistribution || [];
  const weakAreas = data?.weakAreas || [];
  const streak = data?.streak;
  const dailyActivity = data?.dailyActivity || [];
  const programProgress = data?.programProgress || [];

  // ── Pie chart data ──
  const pieData = hoursDist.map(h => ({
    name: h.typeName || '其他',
    value: h.hours,
  }));

  // ── Bar chart data (knowledge mastery, horizontal) ──
  const kpData = kpMastery.map(k => ({
    name: k.kpName,
    rate: k.rate,
    level: k.level,
  }));

  // ── Weak areas (sorted ascending by rate, take 5) ──
  const topWeak = [...weakAreas]
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-6">

        {/* ════════ 1. 标题 ════════ */}
        <div className="mb-2">
          <h1 className="page-title">学习报告</h1>
          <p className="page-subtitle">学习数据全景 · 考试趋势 · 掌握分析</p>
        </div>

        {/* ════════ 1.5 学习画像摘要 ════════ */}
        {data && (
          <ProfileSummaryCard data={data} practiceTrend={practiceTrend} weakAreas={weakAreas} />
        )}

        {/* ════════ 2. 摘要卡片 ════════ */}
        <SummaryCards summary={summary} onGoCertificates={() => router.push('/my-certificates')} />

        {/* ════════ 3. 练习正确率趋势 ════════ */}
        <PracticeTrendCard
          practiceTrend={practiceTrend}
          topKps={topKps}
          activeKps={activeKps}
          onToggleKp={(kp) => setActiveKps(prev =>
            prev.includes(kp) ? prev.filter(k => k !== kp) : [...prev, kp]
          )}
          onGoPractice={() => router.push('/practice')}
        />

        {/* ════════ 4. 知识点掌握度 ════════ */}
        <KpMasteryCard kpData={kpData} />

        {/* ════════ 5. 学时分布 + 薄弱环节 ════════ */}
        <HoursWeakCard
          pieData={pieData}
          topWeak={topWeak}
          approvedHours={summary?.approvedHours || 0}
          onGoPractice={() => router.push('/practice')}
        />

        {/* ════════ 6. 学习活跃度 + 近7天明细 ════════ */}
        <ActivityCard
          streak={streak}
          dailyActivity={dailyActivity}
          recent30DayActive={data?.recent30DayActive ?? 0}
        />

        {/* ════════ 7. 培训班进度 ════════ */}
        <ProgramProgressCard programProgress={programProgress} />

      </div>
    </AppLayout>
  );
}
