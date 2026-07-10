'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const SCENARIOS = [
  {
    id: 'formal',
    icon: '📋',
    title: '正式统考',
    desc: '期末考试、招聘笔试、认证考试',
    preset: {
      timeMode: 'FIXED',
      paperMode: 'SAME',
      tabSwitchLimit: 5,
      copyProtection: true,
      autoSaveInterval: 30,
      durationMinutes: 120,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  },
  {
    id: 'training',
    icon: '📝',
    title: '培训考核',
    desc: '企业内训、阶段测评、课后测试',
    preset: {
      timeMode: 'FLEXIBLE',
      paperMode: 'RANDOM',
      tabSwitchLimit: 3,
      copyProtection: true,
      autoSaveInterval: 30,
      durationMinutes: 60,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  },
  {
    id: 'practice',
    icon: '🎯',
    title: '模拟练习',
    desc: '课后自测、每日一练、考前模拟',
    preset: {
      timeMode: 'FLEXIBLE',
      paperMode: 'SAME',
      tabSwitchLimit: 0,
      copyProtection: false,
      autoSaveInterval: 10,
      durationMinutes: 30,
      shuffleQuestions: false,
      shuffleOptions: true,
    },
  },
];

export default function CreateExam() {
  const router = useRouter();
  const [step, setStep] = useState<'scenario' | 'settings'>('scenario');
  const [scenario, setScenario] = useState<string | null>(null);

  // 表单字段
  const [papers, setPapers] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [paperId, setPaperId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  // 新场景字段
  const [timeMode, setTimeMode] = useState<string>('FIXED');
  const [paperMode, setPaperMode] = useState<string>('SAME');
  const [tabSwitchLimit, setTabSwitchLimit] = useState(5);
  const [copyProtection, setCopyProtection] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);

  // 其他
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [programId, setProgramId] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [propositionById, setPropositionById] = useState('');
  const [lecturers, setLecturers] = useState<any[]>([]);

  useEffect(() => {
    api.papers.list(1).then(r => setPapers(r.items || [])).catch(() => {});
    api.trainingPrograms.list({ page: '1', pageSize: '100' }).then(r => setPrograms(r.items || [])).catch(() => {});
    api.students.list({ pageSize: '100', allRoles: 'true' }).then(r =>
      setLecturers(r.items?.filter((u: any) => u.role === 'LECTURER' || u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN') || [])
    ).catch(() => {});
  }, []);

  // 选择场景 → 应用预设
  const selectScenario = (id: string) => {
    const s = SCENARIOS.find(x => x.id === id);
    if (!s) return;
    setScenario(id);
    setTimeMode(s.preset.timeMode);
    setPaperMode(s.preset.paperMode);
    setTabSwitchLimit(s.preset.tabSwitchLimit);
    setCopyProtection(s.preset.copyProtection);
    setAutoSaveInterval(s.preset.autoSaveInterval);
    setDurationMinutes(s.preset.durationMinutes);
    setShuffleQuestions(s.preset.shuffleQuestions);
    setShuffleOptions(s.preset.shuffleOptions);
    setStep('settings');
  };

  const handleCreate = async () => {
    if (!title || !paperId || !startTime) { setError('请填写必填项（考试名称、试卷、开考时间）'); return; }
    setLoading(true); setError('');
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const exam = await api.exams.create({
        title, paperId: parseInt(paperId), createdBy: user.id || 1,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        durationMinutes, shuffleQuestions, shuffleOptions,
        programId: programId ? parseInt(programId) : undefined,
        passingScore: passingScore ? parseFloat(passingScore) : undefined,
        timeMode, paperMode,
        tabSwitchLimit, copyProtection, autoSaveInterval,
      });
      router.push(`/exams/${exam.id}`);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">📋 创建考试场次</h1>
        <p className="page-subtitle mb-6">{step === 'scenario' ? '先选择考试场景，再调整详细配置' : '配置考试详细参数'}</p>

        {/* ── 步骤1：场景选择 ── */}
        {step === 'scenario' && (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={{ color: 'var(--ink-500)' }}>选择考试场景</p>
            <div className="grid grid-cols-3 gap-4">
              {SCENARIOS.map(s => (
                <div key={s.id} onClick={() => selectScenario(s.id)}
                  className="card p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md text-center"
                  style={{ borderColor: 'var(--ink-100)' }}>
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <h3 className="text-sm font-bold mb-1">{s.title}</h3>
                  <p className="text-xs" style={{ color: 'var(--ink-400)' }}>{s.desc}</p>
                  <div className="mt-3 text-[10px] space-y-0.5" style={{ color: 'var(--ink-300)' }}>
                    <div>时间：{s.preset.timeMode === 'FIXED' ? '统一开考' : '随到随考'}</div>
                    <div>试卷：{s.preset.paperMode === 'SAME' ? '统一试卷' : '随机抽题'}</div>
                    <div>防作弊：{s.preset.tabSwitchLimit > 0 ? `切屏${s.preset.tabSwitchLimit}次限制` : '无限制'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 步骤2：配置表单 ── */}
        {step === 'settings' && (
          <div className="space-y-5">
            {/* 返回 + 场景标签 */}
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('scenario')} className="btn btn-ghost btn-xs">← 重新选择场景</button>
              <span className="tag tag-fox">
                {SCENARIOS.find(s => s.id === scenario)?.icon} {SCENARIOS.find(s => s.id === scenario)?.title}
              </span>
            </div>

            <div className="card p-6 space-y-5">
              {/* 基础信息 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试名称 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="如：2026年第一期期末考试" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>选择试卷 *</label>
                  <select value={paperId} onChange={e => setPaperId(e.target.value)} className="input select">
                    <option value="">— 请选择 —</option>
                    {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>关联培训班</label>
                  <select value={programId} onChange={e => setProgramId(e.target.value)} className="input select">
                    <option value="">— 不关联 —</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ⏰ 时间模式 */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <label className="block text-xs font-semibold mb-3" style={{ color: 'var(--ink-500)' }}>⏰ 时间模式</label>
                <div className="flex gap-4 mb-4">
                  {[
                    { value: 'FIXED', label: '统一开考', desc: '所有考生同一时间开考' },
                    { value: 'FLEXIBLE', label: '随到随考', desc: '考生在开放期间内自由安排' },
                  ].map(t => (
                    <label key={t.value} className="flex items-start gap-2 cursor-pointer flex-1 p-3 rounded-lg transition-all"
                      style={{
                        background: timeMode === t.value ? 'var(--fox-pale)' : 'var(--paper)',
                        border: `1px solid ${timeMode === t.value ? 'var(--fox)' : 'var(--ink-100)'}`,
                      }}>
                      <input type="radio" name="timeMode" checked={timeMode === t.value} onChange={() => setTimeMode(t.value)}
                        className="mt-0.5 accent-[#e87a30]" />
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                      {timeMode === 'FIXED' ? '开考时间 *' : '开放开始'}
                    </label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                      {timeMode === 'FIXED' ? '结束时间' : '开放结束'}
                    </label>
                    <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>答题时长（分钟）</label>
                  <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="input" min={1} style={{ width: '120px' }} />
                </div>
              </div>

              {/* 📄 试卷模式 */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <label className="block text-xs font-semibold mb-3" style={{ color: 'var(--ink-500)' }}>📄 试卷模式</label>
                <div className="flex gap-4 mb-3">
                  {[
                    { value: 'SAME', label: '统一试卷', desc: '所有考生做同一套题' },
                    { value: 'RANDOM', label: '随机抽题', desc: '每名考生随机抽题' },
                  ].map(t => (
                    <label key={t.value} className="flex items-start gap-2 cursor-pointer flex-1 p-3 rounded-lg transition-all"
                      style={{
                        background: paperMode === t.value ? 'var(--fox-pale)' : 'var(--paper)',
                        border: `1px solid ${paperMode === t.value ? 'var(--fox)' : 'var(--ink-100)'}`,
                      }}>
                      <input type="radio" name="paperMode" checked={paperMode === t.value} onChange={() => setPaperMode(t.value)}
                        className="mt-0.5 accent-[#e87a30]" />
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)}
                      className="accent-[#e87a30]" />
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>题序乱序</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={shuffleOptions} onChange={e => setShuffleOptions(e.target.checked)}
                      className="accent-[#e87a30]" />
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>选项乱序</span>
                  </label>
                </div>
              </div>

              {/* 🛡️ 防作弊设置 */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <label className="block text-xs font-semibold mb-3" style={{ color: 'var(--ink-500)' }}>🛡️ 防作弊设置</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                      切屏限制 <span className="font-normal" style={{ color: 'var(--ink-300)' }}>（0=不限制）</span>
                    </label>
                    <input type="number" value={tabSwitchLimit} onChange={e => setTabSwitchLimit(Number(e.target.value))}
                      className="input" min={0} style={{ width: '100px' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                      自动保存 <span className="font-normal" style={{ color: 'var(--ink-300)' }}>（秒）</span>
                    </label>
                    <input type="number" value={autoSaveInterval} onChange={e => setAutoSaveInterval(Number(e.target.value))}
                      className="input" min={0} style={{ width: '100px' }} />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={copyProtection} onChange={e => setCopyProtection(e.target.checked)}
                    className="accent-[#e87a30]" />
                  <span className="text-xs" style={{ color: 'var(--ink-500)' }}>禁止复制粘贴</span>
                </label>
              </div>

              {/* 其他设置 */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <label className="block text-xs font-semibold mb-3" style={{ color: 'var(--ink-500)' }}>其他设置</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>合格线（分）</label>
                    <input type="number" value={passingScore} onChange={e => setPassingScore(e.target.value)}
                      className="input" placeholder="默认60%" min={0} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>命题人</label>
                    <select value={propositionById} onChange={e => setPropositionById(e.target.value)} className="input select">
                      <option value="">— 未指定 —</option>
                      {lecturers.map((l: any) => <option key={l.id} value={l.id}>{l.displayName}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>⚠ {error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={loading} className="btn btn-fox btn-sm">{loading ? '创建中…' : '创建考试'}</button>
                <button onClick={() => router.push('/exams')} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
