'use client';

import { useState } from 'react';
import AppLayout from '@/components/app-layout';

/** 二期原型：考试场次管理 */
export default function ExamSessionsPrototype() {
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'ongoing' | 'finished'>('all');

  // 模拟数据
  const sessions = [
    { id: 1, name: 'DTM 数智化管理师 模拟考（一）', paper: 'DT+DTM-202606-001', group: 'DTM一期班', startTime: '2026-06-20 09:00', endTime: '2026-06-20 11:00', duration: 120, status: 'UPCOMING', candidates: 45, type: '统一开考', proctor: '张老师' },
    { id: 2, name: 'DTM 期中水平测试', paper: 'DT+DTM-202606-008', group: 'DTM一期班', startTime: '2026-06-18 14:00', endTime: '2026-06-18 16:00', duration: 120, status: 'UPCOMING', candidates: 45, type: '统一开考', proctor: '李老师' },
    { id: 3, name: '数字化转型基础 随到随考', paper: 'DT+DTM-202606-003', group: 'DTM一期班', startTime: '2026-06-15 08:00', endTime: '2026-06-20 18:00', duration: 90, status: 'ONGOING', candidates: 12, type: '随到随考', proctor: '—' },
    { id: 4, name: 'DTM 摸底测试（已结束）', paper: 'DT+DTM-202606-002', group: 'DTM一期班', startTime: '2026-06-10 09:00', endTime: '2026-06-10 11:00', duration: 120, status: 'FINISHED', candidates: 42, type: '统一开考', proctor: '张老师' },
    { id: 5, name: '数据治理 单元测试', paper: 'DT+DTGV-202606-001', group: '数据治理班', startTime: '2026-06-08 14:00', endTime: '2026-06-08 15:30', duration: 90, status: 'FINISHED', candidates: 28, type: '统一开考', proctor: '王老师' },
  ];

  const filtered = activeTab === 'all' ? sessions : sessions.filter(s => s.status === activeTab.toUpperCase());

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      UPCOMING: { label: '待开考', cls: 'tag-gold' },
      ONGOING: { label: '进行中', cls: 'tag-cyan' },
      FINISHED: { label: '已结束', cls: 'tag-ink' },
    };
    const m = map[s] || { label: s, cls: 'tag-ink' };
    return <span className={`tag ${m.cls}`}>{m.label}</span>;
  };

  return (
    <AppLayout>
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>二期原型</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">🏫 考试场次管理</h1>
            <p className="page-subtitle mt-1">
              管理所有考试场次 · 创建统一开考或随到随考 · 实时监控考试状态
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="btn btn-fox">＋ 创建考试场次</button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '总场次', value: sessions.length, icon: '📋', color: 'var(--ink-800)' },
          { label: '待开考', value: sessions.filter(s => s.status === 'UPCOMING').length, icon: '⏳', color: 'var(--gold-dark)' },
          { label: '进行中', value: sessions.filter(s => s.status === 'ONGOING').length, icon: '✍️', color: 'var(--cyan)' },
          { label: '已结束', value: sessions.filter(s => s.status === 'FINISHED').length, icon: '✅', color: 'var(--ink-300)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between mb-2">
              <span className="text-lg opacity-60">{s.icon}</span>
            </div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        {[
          { key: 'all', label: '全部' },
          { key: 'upcoming', label: '待开考' },
          { key: 'ongoing', label: '进行中' },
          { key: 'finished', label: '已结束' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className="px-5 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors bg-transparent"
            style={{
              borderColor: activeTab === t.key ? 'var(--fox)' : 'transparent',
              color: activeTab === t.key ? 'var(--ink-800)' : 'var(--ink-300)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Session cards */}
      <div className="space-y-3">
        {filtered.map(s => (
          <div key={s.id} className="card p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--fox)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-serif font-bold text-sm" style={{ color: 'var(--ink-800)' }}>{s.name}</h3>
                  {statusBadge(s.status)}
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: s.type === '随到随考' ? 'var(--cyan-glow)' : 'var(--gold-glow)', color: s.type === '随到随考' ? 'var(--cyan)' : 'var(--gold-dark)' }}>
                    {s.type}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs" style={{ color: 'var(--ink-400)' }}>
                  <span>📄 {s.paper}</span>
                  <span>👥 {s.group} · {s.candidates}人</span>
                  <span>⏱ {s.duration}分钟</span>
                  {s.proctor !== '—' && <span>👨‍🏫 监考：{s.proctor}</span>}
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--ink-300)' }}>
                  <span>🕐 {s.startTime} → {s.endTime}</span>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {s.status === 'UPCOMING' && (
                  <>
                    <button className="btn btn-outline btn-xs">编辑</button>
                    <button className="btn btn-cyan btn-xs" style={{ background: 'var(--cyan)', color: '#fff' }}>开始考试</button>
                  </>
                )}
                {s.status === 'ONGOING' && (
                  <>
                    <button className="btn btn-outline btn-xs">👁 监考面板</button>
                    <button className="btn btn-verm btn-xs">强制收卷</button>
                  </>
                )}
                {s.status === 'FINISHED' && (
                  <>
                    <button className="btn btn-outline btn-xs">📊 成绩统计</button>
                    <button className="btn btn-outline btn-xs">📥 导出</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Session Modal (prototype) */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-card max-w-[680px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">创建考试场次</h3>
              <button onClick={() => setShowCreate(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-5">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试名称</label>
                  <input className="input" placeholder="如：DTM 数智化管理师 模拟考（二）" defaultValue="" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>选择试卷</label>
                  <select className="input select" defaultValue="">
                    <option value="" disabled>请选择已定稿的试卷</option>
                    <option>DT+DTM-202606-008 · 期中水平测试（100分/120分钟）</option>
                    <option>DT+DTM-202606-003 · 数字化转型基础（100分/90分钟）</option>
                    <option>DT+DTM-202606-002 · 摸底测试（100分/120分钟）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试类型</label>
                  <select className="input select" defaultValue="统一开考">
                    <option>统一开考（所有人同时开始同时结束）</option>
                    <option>随到随考（灵活时段内自由参加）</option>
                  </select>
                </div>
              </div>

              {/* 时间设置 */}
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>⏱ 时间设置</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>开始时间</label>
                    <input className="input" type="datetime-local" defaultValue="2026-06-22T09:00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>结束时间</label>
                    <input className="input" type="datetime-local" defaultValue="2026-06-22T11:00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试时长（分钟）</label>
                    <input className="input" type="number" defaultValue={120} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>迟到禁止入场（分钟）</label>
                    <input className="input" type="number" defaultValue={30} placeholder="开考后多久禁止入场" />
                  </div>
                </div>
              </div>

              {/* 考生范围 */}
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>👥 考生范围</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>指定分组</label>
                    <select className="input select" defaultValue="DTM一期班">
                      <option>全部学员</option>
                      <option>DTM一期班（45人）</option>
                      <option>数据治理班（28人）</option>
                      <option>DTC咨询师班（16人）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>监考人</label>
                    <input className="input" placeholder="监考人姓名" defaultValue="张老师" />
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>
                  已选：<strong>DTM一期班</strong>，共 <strong>45</strong> 名学员将参加本场考试
                </p>
              </div>

              {/* 防作弊设置 */}
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>🛡 防作弊设置</h4>
                <div className="space-y-3">
                  {[
                    { label: '禁止切屏', desc: '切屏超过3次自动交卷', checked: true },
                    { label: '禁止复制粘贴', desc: '禁用右键菜单和快捷键复制', checked: true },
                    { label: 'IP 限制', desc: '每IP仅允许一个设备登录考试', checked: false },
                    { label: '人脸验证', desc: '开始考试前拍照验证身份', checked: false },
                  ].map((opt, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked={opt.checked}
                        className="w-4 h-4 rounded" style={{ accentColor: 'var(--fox)' }} />
                      <div>
                        <span className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{opt.label}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--ink-300)' }}>{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer gap-3">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={() => { alert('✅ 原型演示：考试场次创建成功！实际功能开发时实现。'); setShowCreate(false); }}
                className="btn btn-fox">创建场次</button>
            </div>
          </div>
        </div>
      )}

      {/* Prototype note */}
      <div className="mt-8 p-4 rounded-lg text-xs" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
        🦊 这是二期原型的交互演示，数据为模拟数据。等你回来一起审需求和调整。
      </div>
    </AppLayout>
  );
}
