'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const SCENARIOS = [
  { id: 'formal', icon: '📋', title: '正式统考' },
  { id: 'training', icon: '📝', title: '培训考核' },
  { id: 'practice', icon: '🎯', title: '模拟练习' },
];

export default function EditExam() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.id);

  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 表单字段
  const [title, setTitle] = useState('');
  const [paperId, setPaperId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [timeMode, setTimeMode] = useState<string>('FIXED');
  const [paperMode, setPaperMode] = useState<string>('SAME');
  const [tabSwitchLimit, setTabSwitchLimit] = useState(5);
  const [copyProtection, setCopyProtection] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [programId, setProgramId] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);

  useEffect(() => {
    api.papers.list(1).then(r => setPapers(r.items || [])).catch(() => {});
    api.trainingPrograms.list({ page: '1', pageSize: '100' }).then(r => setPrograms(r.items || [])).catch(() => {});

    // 加载已有考试数据
    api.exams.get(examId).then(exam => {
      if (exam.status !== 'DRAFT') { router.push(`/exams/${examId}`); return; }
      setTitle(exam.title || '');
      setPaperId(String(exam.paperId || ''));
      setStartTime(exam.startTime?.slice(0, 16) || '');
      setEndTime(exam.endTime?.slice(0, 16) || '');
      setDurationMinutes(exam.durationMinutes || 90);
      setShuffleQuestions(exam.shuffleQuestions ?? true);
      setShuffleOptions(exam.shuffleOptions ?? true);
      setTimeMode(exam.timeMode || 'FIXED');
      setPaperMode(exam.paperMode || 'SAME');
      setTabSwitchLimit(exam.tabSwitchLimit ?? 5);
      setCopyProtection(exam.copyProtection ?? true);
      setAutoSaveInterval(exam.autoSaveInterval ?? 30);
      setPassingScore(exam.passingScore ?? '');
      setProgramId(exam.programId ? String(exam.programId) : '');
      setLoading(false);
    }).catch(() => { router.push('/exams'); });
  }, [examId, router]);

  // 推断场景
  const inferredScenario = timeMode === 'FIXED' && paperMode === 'SAME' && tabSwitchLimit >= 3 ? 'formal'
    : timeMode === 'FLEXIBLE' && paperMode === 'RANDOM' ? 'training'
    : 'practice';
  const scenarioLabel = SCENARIOS.find(s => s.id === inferredScenario);

  const handleUpdate = async () => {
    if (!title || !paperId || !startTime) { setError('请填写必填项'); return; }
    setSaving(true); setError('');
    try {
      await api.exams.update(examId, {
        title, paperId: parseInt(paperId),
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        durationMinutes, shuffleQuestions, shuffleOptions,
        timeMode, paperMode, tabSwitchLimit, copyProtection, autoSaveInterval,
        programId: programId ? parseInt(programId) : undefined,
        passingScore: passingScore ? parseFloat(passingScore) : undefined,
      });
      router.push(`/exams/${examId}`);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  if (loading) return (
    <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中… 🦊</div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">✏️ 编辑考试场次</h1>
        <p className="page-subtitle mb-6">修改考试配置（草稿状态）</p>

        <div className="space-y-5">
          {/* 场景标签（只读展示） */}
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--ink-400)' }}>创建时选定的场景</span>
            <span className="tag tag-fox">
              {scenarioLabel?.icon} {scenarioLabel?.title}
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-300)' }}>（如需切换请删除重建）</span>
          </div>

          <div className="card p-6 space-y-5">
            {/* 基础信息 */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试名称 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input" />
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
                      className="mt-0.5 accent-[var(--fox)]" />
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
                      className="mt-0.5 accent-[var(--fox)]" />
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
                    className="accent-[var(--fox)]" />
                  <span className="text-xs" style={{ color: 'var(--ink-500)' }}>题序乱序</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shuffleOptions} onChange={e => setShuffleOptions(e.target.checked)}
                    className="accent-[var(--fox)]" />
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
                  className="accent-[var(--fox)]" />
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
              </div>
            </div>

            {error && <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>⚠ {error}</div>}
            <div className="flex gap-3 pt-2">
              <button onClick={handleUpdate} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存修改'}</button>
              <button onClick={() => router.push(`/exams/${examId}`)} className="btn btn-outline btn-sm">取消</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
