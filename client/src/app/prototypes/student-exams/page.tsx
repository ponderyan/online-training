'use client';

import { useState } from 'react';

/** 二期原型：学员端 - 我的考试 */
export default function StudentExamsPrototype() {
  const [activeTab, setActiveTab] = useState<'pending' | 'ongoing' | 'finished'>('pending');
  const [showExamInstructions, setShowExamInstructions] = useState(false);

  const exams = [
    { id: 1, name: 'DTM 数智化管理师 模拟考（一）', paper: 'DT+DTM-202606-001', duration: 120, totalScore: 100, questionCount: 48, type: '统一开考', startTime: '2026-06-20 09:00', endTime: '2026-06-20 11:00', status: 'pending', progress: 0 },
    { id: 2, name: '数字化转型基础 随到随考', paper: 'DT+DTM-202606-003', duration: 90, totalScore: 100, questionCount: 38, type: '随到随考', startTime: '2026-06-15 08:00', endTime: '2026-06-20 18:00', status: 'pending', progress: 0 },
    { id: 3, name: 'DTM 期中水平测试', paper: 'DT+DTM-202606-008', duration: 120, totalScore: 100, questionCount: 50, type: '统一开考', startTime: '2026-06-18 14:00', endTime: '2026-06-18 16:00', status: 'pending', progress: 0 },
    { id: 4, name: '第一章：数字化转型基础 单元测验', paper: 'DT+DTM-202606-005', duration: 45, totalScore: 30, questionCount: 15, type: '随到随考', startTime: '—', endTime: '—', status: 'ongoing', progress: 60 },
    { id: 5, name: 'DTM 摸底测试', paper: 'DT+DTM-202606-002', duration: 120, totalScore: 100, questionCount: 48, type: '统一开考', startTime: '2026-06-10 09:00', endTime: '2026-06-10 11:00', status: 'finished', score: 82, correctCount: 38, wrongCount: 8, pendingCount: 2 },
    { id: 6, name: '数据治理 单元测试', paper: 'DT+DTGV-202606-001', duration: 90, totalScore: 100, questionCount: 40, type: '统一开考', startTime: '2026-06-08 14:00', endTime: '2026-06-08 15:30', status: 'finished', score: 76, correctCount: 34, wrongCount: 10, pendingCount: 0 },
  ];

  const filtered = exams.filter(e => e.status === activeTab);

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Top bar — student header */}
      <header className="sticky top-0 z-10 border-b" style={{ background: 'var(--paper-bright)', borderColor: 'var(--ink-100)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--fox-glow)' }}>
              <span className="text-sm">🦊</span>
            </div>
            <span className="font-serif font-bold text-sm" style={{ color: 'var(--ink-800)' }}>FoxLearn · 我的学习</span>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
            <span className="cursor-pointer hover:text-[var(--fox)]">📚 我的课程</span>
            <span className="cursor-pointer hover:text-[var(--fox)] font-medium" style={{ color: 'var(--fox)' }}>📋 我的考试</span>
            <span className="cursor-pointer hover:text-[var(--fox)]">📊 我的成绩</span>
            <span className="w-px h-4" style={{ background: 'var(--ink-100)' }} />
            <span className="flex items-center gap-1.5 cursor-pointer">
              <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>张</span>
              张三
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-xl font-serif font-bold" style={{ color: 'var(--ink-800)' }}>我的考试</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-400)' }}>
            小狐狸提醒你：共 {exams.length} 场考试，{exams.filter(e => e.status === 'pending').length} 场待参加
          </p>
        </div>

        {/* Tab */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--ink-100)' }}>
          {[
            { key: 'pending', label: '待参加', count: exams.filter(e => e.status === 'pending').length },
            { key: 'ongoing', label: '进行中', count: exams.filter(e => e.status === 'ongoing').length },
            { key: 'finished', label: '已完成', count: exams.filter(e => e.status === 'finished').length },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className="px-5 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent flex items-center gap-2"
              style={{
                borderColor: activeTab === t.key ? 'var(--fox)' : 'transparent',
                color: activeTab === t.key ? 'var(--ink-800)' : 'var(--ink-300)',
              }}>
              {t.label}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                background: activeTab === t.key ? 'var(--fox-glow)' : 'var(--paper-dark)',
                color: activeTab === t.key ? 'var(--fox-dark)' : 'var(--ink-300)',
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Exam cards */}
        <div className="space-y-4">
          {filtered.map(e => (
            <div key={e.id} className="card p-6 transition-all hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-serif font-bold text-sm" style={{ color: 'var(--ink-800)' }}>{e.name}</h3>
                    {e.type === '随到随考' && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: 'var(--cyan-glow)', color: 'var(--cyan)' }}>随到随考</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--ink-400)' }}>
                    <span>📄 {e.paper}</span>
                    <span>⏱ {e.duration}分钟</span>
                    <span>{e.totalScore}分 · {e.questionCount}题</span>
                    {e.status === 'pending' && e.type === '统一开考' && (
                      <span style={{ color: 'var(--gold-dark)' }}>🕐 {e.startTime} — {e.endTime}</span>
                    )}
                    {e.status === 'pending' && e.type === '随到随考' && (
                      <span style={{ color: 'var(--cyan)' }}>🕐 灵活时段 · 截至 {e.endTime}</span>
                    )}
                  </div>

                  {e.status === 'ongoing' && (
                    <div className="mt-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${e.progress}%`, background: 'var(--fox)' }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>{e.progress}%</span>
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--fox)' }}>
                        ✍️ 上次做到第9题，继续答题？
                      </p>
                    </div>
                  )}

                  {e.status === 'finished' && (
                    <div className="mt-3 pt-3 border-t border-dashed" style={{ borderColor: 'var(--ink-100)' }}>
                      <div className="flex items-center gap-5">
                        <div>
                          <span className="text-lg font-serif font-bold" style={{ color: (e.score || 0) >= 60 ? 'var(--cyan)' : 'var(--verm)' }}>{e.score}</span>
                          <span className="text-xs ml-0.5" style={{ color: 'var(--ink-300)' }}>/{e.totalScore}分</span>
                        </div>
                        <div className="flex gap-4 text-xs" style={{ color: 'var(--ink-400)' }}>
                          <span>✅ 正确 {(e.correctCount as number) || 0}</span>
                          <span style={{ color: 'var(--verm)' }}>❌ 错误 {(e.wrongCount as number) || 0}</span>
                          {(e.pendingCount as number) > 0 && <span style={{ color: 'var(--gold)' }}>⏳ 待判 {(e.pendingCount as number) || 0}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {e.status === 'pending' && (
                    <div className="flex flex-col gap-2 items-end">
                      <button onClick={() => setShowExamInstructions(true)}
                        className="btn btn-fox btn-sm">进入考场</button>
                      <button className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}>查看详情</button>
                    </div>
                  )}
                  {e.status === 'ongoing' && (
                    <button onClick={() => setShowExamInstructions(true)}
                      className="btn btn-fox btn-sm animate-pulse">继续答题 →</button>
                  )}
                  {e.status === 'finished' && (
                    <div className="flex flex-col gap-2 items-end">
                      <button className="btn btn-outline btn-sm">查看成绩</button>
                      <button className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}>错题回顾</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exam instructions modal (prototype) */}
      {showExamInstructions && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExamInstructions(false); }}>
          <div className="modal-card max-w-[560px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">📋 考试须知</h3>
              <button onClick={() => setShowExamInstructions(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-4 rounded-lg" style={{ background: 'var(--fox-glow)' }}>
                <h4 className="font-serif font-bold text-sm mb-2" style={{ color: 'var(--fox-dark)' }}>DTM 数智化管理师 模拟考（一）</h4>
                <div className="flex gap-4 text-xs" style={{ color: 'var(--fox-dark)' }}>
                  <span>⏱ 120分钟</span>
                  <span>📄 48题</span>
                  <span>💯 100分</span>
                </div>
              </div>

              <div className="space-y-2 text-sm" style={{ color: 'var(--ink-600)' }}>
                <p className="font-semibold" style={{ color: 'var(--ink-800)' }}>考试规则</p>
                <p>1. 本次考试为闭卷考试，不得查阅任何资料。</p>
                <p>2. 总时长 120 分钟，考试开始后不得中途退出。</p>
                <p>3. 考试期间切屏超过 <strong>3</strong> 次，系统将自动交卷。</p>
                <p>4. 客观题提交后自动判分，主观题由阅卷人人工判分。</p>
                <p>5. 如遇技术问题，请联系监考老师。</p>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ background: 'var(--paper)' }}>
                <input type="checkbox" className="w-4 h-4" style={{ accentColor: 'var(--fox)' }} />
                <span className="text-sm" style={{ color: 'var(--ink-600)' }}>我已阅读并同意以上考试规则</span>
              </label>
            </div>
            <div className="modal-footer gap-3">
              <button onClick={() => setShowExamInstructions(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={() => { alert('✅ 原型演示：开始答题！将跳转到答题页面。'); setShowExamInstructions(false); }}
                className="btn btn-fox">开始答题</button>
            </div>
          </div>
        </div>
      )}

      {/* Prototype note */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="p-4 rounded-lg text-xs" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
          🦊 这是二期原型的交互演示，数据为模拟数据。等你回来一起审需求和调整。
        </div>
      </div>
    </div>
  );
}
