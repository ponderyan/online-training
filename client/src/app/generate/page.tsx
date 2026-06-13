'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', TRUE_FALSE: '判断题',
  FILL_BLANK: '填空题', SHORT_ANSWER: '简答题', CASE_STUDY: '案例题',
};
const DIFFS = ['EASY', 'MEDIUM_EASY', 'MEDIUM_HARD', 'HARD'] as const;
const DIFF_LABELS = ['易', '较易', '较难', '难'];
const DIFF_COLORS = ['#00897b', '#c9a03a', '#8a6e4f', '#d9364a'];

function GeneratePageContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>({ id: 1 });
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<number>(1);
  const [paperName, setPaperName] = useState('');
  const [totalScore, setTotalScore] = useState(100);
  const [duration, setDuration] = useState(90);
  const [isOpenBook, setIsOpenBook] = useState(false);
  const [chapterStrategy, setChapterStrategy] = useState('EVEN');

  const allTypes = Object.keys(TYPE_NAMES);
  const [enabledTypes, setEnabledTypes] = useState<string[]>(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FILL_BLANK']);
  const [typeConfigs, setTypeConfigs] = useState<Record<string, { count: number; score: number; blanksPerQ?: number }>>({
    SINGLE_CHOICE: { count: 20, score: 1 },
    MULTIPLE_CHOICE: { count: 5, score: 2 },
    TRUE_FALSE: { count: 0, score: 0 },
    FILL_BLANK: { count: 5, score: 1, blanksPerQ: 2 },
    SHORT_ANSWER: { count: 0, score: 0 },
    CASE_STUDY: { count: 0, score: 0 },
  });

  const [difficulty, setDifficulty] = useState<Record<string, number>>({
    EASY: 10, MEDIUM_EASY: 40, MEDIUM_HARD: 30, HARD: 20,
  });
  const [sourceMix, setSourceMix] = useState(70);
  const [questionCounts, setQuestionCounts] = useState<{ subject: number; public: number } | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!subjectId) return;
      setCountsLoading(true);
      try {
        const [subRes, pubRes] = await Promise.all([
          api.questions.list({ subjectId: String(subjectId), status: 'PUBLISHED', pageSize: '1' }),
          api.questions.list({ isPublic: 'true', status: 'PUBLISHED', pageSize: '1' }),
        ]);
        setQuestionCounts({ subject: subRes.total, public: pubRes.total });
      } catch { setQuestionCounts(null); }
      setCountsLoading(false);
    };
    fetchCounts();
  }, [subjectId]);

  const [generated, setGenerated] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u.id) setUser(u); } catch {}
    api.subjects.list().then(subs => {
      setSubjects(subs);
      if (subs.length > 0) {
        const copyFrom = searchParams.get('copyFrom');
        if (copyFrom) {
          api.papers.get(Number(copyFrom)).then(p => {
            setPaperName(p.name + ' (副本)');
            setSubjectId(p.subjectId);
            setTotalScore(p.totalScore);
            setDuration(p.durationMinutes || 90);
            setIsOpenBook(p.isOpenBook || false);
            if (p.typeConfigs?.length) {
              const configs: Record<string, any> = {};
              const enabled: string[] = [];
              for (const tc of p.typeConfigs) {
                enabled.push(tc.questionType);
                configs[tc.questionType] = {
                  count: tc.count,
                  score: tc.scorePerQuestion,
                  blanksPerQ: tc.blanksPerQuestion || 1,
                };
              }
              setEnabledTypes(enabled);
              setTypeConfigs(prev => ({ ...prev, ...configs }));
            }
            if (p.difficultyDistribution) setDifficulty(p.difficultyDistribution);
            if (p.chapterStrategy) setChapterStrategy(p.chapterStrategy);
            if (p.sourceMix !== undefined) setSourceMix(p.sourceMix);
          }).catch(() => {
            setPaperName(`DT+ ${subs[0].name} 模拟卷`);
            setSubjectId(subs[0].id);
          });
        } else {
          setSubjectId(subs[0].id);
          setPaperName(`DT+ ${subs[0].name} 模拟卷`);
        }
      }
    }).catch(() => {});
  }, []);

  const toggleType = (t: string) => {
    setEnabledTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const updateTypeConfig = (t: string, field: string, value: number) => {
    setTypeConfigs(prev => ({ ...prev, [t]: { ...prev[t], [field]: value } }));
  };

  const subtotal = (t: string) => {
    const cfg = typeConfigs[t];
    if (!cfg) return 0;
    if (t === 'FILL_BLANK') return cfg.count * (cfg.blanksPerQ || 1) * cfg.score;
    return cfg.count * cfg.score;
  };

  const totalFromTypes = () => enabledTypes.reduce((s, t) => s + subtotal(t), 0);
  const scoreValid = totalFromTypes() === totalScore;
  const totalQ = () => enabledTypes.filter(t => typeConfigs[t]?.count > 0).reduce((s, t) => s + typeConfigs[t].count, 0);

  const adjustDifficulty = (idx: number) => {
    setDifficulty(prev => {
      const keys = Object.keys(prev);
      const current = prev[keys[idx]];
      const maxOthers = 100 - (Object.keys(prev).length - 1) * 5;
      const delta = current >= maxOthers ? -5 : 5;
      const newVal = Math.min(Math.max(current + delta, 5), maxOthers);
      const totalOthers = Object.values(prev).reduce((s, v, i) => s + (i === idx ? 0 : v), 0);
      const newOthers = (100 - newVal) / (keys.length - 1);
      return Object.fromEntries(keys.map((k, i) =>
        i === idx ? [k, newVal] : [k, Math.round(newOthers)]
      ));
    });
  };

  const handleGenerate = async () => {
    if (!scoreValid) { setError(`题型总分 ${totalFromTypes()} ≠ 试卷总分 ${totalScore}`); return; }
    setError('');
    setGenerating(true);
    try {
      const payload = {
        name: paperName, subjectId, totalScore, durationMinutes: duration, isOpenBook,
        createdBy: user.id, chapterStrategy, sourceMix,
        difficultyDistribution: difficulty,
        typeConfigs: enabledTypes.filter(t => typeConfigs[t]?.count > 0).map(t => ({
          questionType: t, count: typeConfigs[t].count,
          scorePerQuestion: t === 'FILL_BLANK'
            ? typeConfigs[t].score * (typeConfigs[t].blanksPerQ || 1)
            : typeConfigs[t].score,
        })),
      };
      const result = await api.papers.generate(payload);
      setGenerated(result);
    } catch (e: any) {
      setError(e.message);
    } finally { setGenerating(false); }
  };

  const handleFinalize = async () => {
    if (!generated) return;
    await api.papers.finalize(generated.id);
    router.push('/papers');
  };

  return (
    <AppLayout>
      <div className="mb-7">
        <h1 className="page-title">智能组卷</h1>
        <p className="page-subtitle">配置试卷参数 · 系统自动抽题生成</p>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-6 items-start" style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* 左侧：配置面板 */}
        <div className="card p-6">
          <h3 className="section-title">组卷配置</h3>

          {/* 科目 + 名称 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试科目</label>
              <select value={subjectId} onChange={e => {
                const id = Number(e.target.value);
                setSubjectId(id);
                const sub = subjects.find(s => s.id === id);
                if (sub) setPaperName(`DT+ ${sub.name} 模拟卷`);
              }} className="input select">
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>试卷名称</label>
              <input value={paperName} onChange={e => setPaperName(e.target.value)} className="input" />
            </div>
          </div>

          {/* 分值 + 时间 + 开闭卷 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>总分值</label>
              <input type="number" value={totalScore} onChange={e => setTotalScore(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>考试时间（分）</label>
              <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>开卷/闭卷</label>
              <select value={isOpenBook ? 'open' : 'closed'} onChange={e => setIsOpenBook(e.target.value === 'open')} className="input select">
                <option value="closed">闭卷</option><option value="open">开卷</option>
              </select>
            </div>
          </div>

          {/* 章节策略 */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>章节分布策略</label>
            <select value={chapterStrategy} onChange={e => setChapterStrategy(e.target.value)} className="input select">
              <option value="EVEN">均匀分布（每章约均分题量）</option>
              <option value="WEIGHTED">按权重分布（需设置章节权重）</option>
              <option value="RANDOM">随机分布（不按章节）</option>
            </select>
          </div>

          {/* 题型选择 */}
          <div className="section-title mt-6">选择考试题型</div>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {allTypes.map(t => {
              const checked = enabledTypes.includes(t);
              return (
                <div key={t} onClick={() => toggleType(t)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border rounded-lg cursor-pointer text-sm transition-all"
                  style={{
                    borderColor: checked ? 'var(--gold)' : 'var(--ink-100)',
                    background: checked ? 'var(--gold-glow)' : 'transparent',
                  }}>
                  <span className="w-4 h-4 rounded border flex items-center justify-center text-[7px] transition-all flex-shrink-0"
                    style={{
                      borderColor: checked ? 'var(--gold)' : 'var(--ink-100)',
                      background: checked ? 'var(--gold)' : 'transparent',
                      color: checked ? '#fff' : 'transparent',
                    }}>
                    ✓
                  </span>
                  {TYPE_NAMES[t]}
                </div>
              );
            })}
          </div>

          {/* 题型参数 */}
          {enabledTypes.map(t => (
            <div key={t} className="border border-[var(--ink-100)] rounded-lg mb-2 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--paper)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{TYPE_NAMES[t]}</span>
                <span className="text-xs" style={{ color: 'var(--ink-400)' }}>小计 {subtotal(t)} 分</span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_60px] gap-3 p-4 border-t border-[var(--ink-100)]">
                <div>
                  <label className="block text-xs mb-0.5" style={{ color: 'var(--ink-400)' }}>题数</label>
                  <input type="number" value={typeConfigs[t]?.count || 0}
                    onChange={e => updateTypeConfig(t, 'count', Number(e.target.value))} className="input" />
                </div>
                <div>
                  <label className="block text-xs mb-0.5" style={{ color: 'var(--ink-400)' }}>
                    {t === 'FILL_BLANK' ? '每空分值' : '每题分值'}
                  </label>
                  <input type="number" value={typeConfigs[t]?.score || 0}
                    onChange={e => updateTypeConfig(t, 'score', Number(e.target.value))} className="input" />
                </div>
                {t === 'FILL_BLANK' && (
                  <div>
                    <label className="block text-xs mb-0.5" style={{ color: 'var(--ink-400)' }}>每空数</label>
                    <input type="number" value={typeConfigs[t]?.blanksPerQ || 1}
                      onChange={e => updateTypeConfig(t, 'blanksPerQ', Number(e.target.value))} className="input" />
                  </div>
                )}
                <div className="flex items-end pb-1.5">
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {t === 'FILL_BLANK' ? '题×空×分' : '题×分'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* 分值校验 */}
          <div className="mb-4">
            {!scoreValid ? (
              <div className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
                ⚠ 题型总分 {totalFromTypes()} 分 ≠ 试卷总分 {totalScore} 分
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: 'var(--cyan-glow)', color: 'var(--cyan)' }}>
                ✓ 题型总分 {totalFromTypes()} 分 = 试卷总分 {totalScore} 分
              </div>
            )}
          </div>

          {/* 难度配置 */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-500)' }}>
              难度比例配置 <span style={{ color: 'var(--ink-300' }}>（点击调整）</span>
            </label>
            <div className="flex gap-1.5 h-9">
              {DIFFS.map((d, i) => (
                <div key={d} onClick={() => adjustDifficulty(i)}
                  className="flex items-center justify-center text-white text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    flex: difficulty[d],
                    backgroundColor: DIFF_COLORS[i],
                    height: 22 + difficulty[d] * 0.3,
                    minWidth: '40px',
                  }}>
                  {DIFF_LABELS[i]} {difficulty[d]}%
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2">
              {DIFF_LABELS.map((l, i) => (
                <span key={l} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-400)' }}>
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: DIFF_COLORS[i] }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* 来源比例 */}
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>试题来源比例</label>
            <div className="flex items-center gap-3">
              <span className="tag tag-gold flex-shrink-0">
                {subjects.find(s => s.id === subjectId)?.code || '科目'} 专用
              </span>
              <input type="range" min={0} max={100} value={sourceMix}
                onChange={e => setSourceMix(Number(e.target.value))}
                className="flex-1 h-1.5 rounded cursor-pointer"
                style={{ accentColor: '#c9a03a' }} />
              <span className="tag tag-ink">公共 {100 - sourceMix}%</span>
            </div>
            {questionCounts && !countsLoading && (
              <div className="mt-2 space-y-1">
                {sourceMix > 0 && questionCounts.subject === 0 && (
                  <div className="text-xs" style={{ color: 'var(--verm)' }}>⚠ 当前科目没有已发布的试题</div>
                )}
                {sourceMix < 100 && questionCounts.public === 0 && (
                  <div className="text-xs" style={{ color: 'var(--verm)' }}>⚠ 公共题库为空</div>
                )}
                {questionCounts.subject > 0 && (
                  <div className="text-xs" style={{ color: 'var(--ink-400)' }}>
                    题库：{questionCounts.subject} 题 / 公共：{questionCounts.public} 题
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="text-sm mb-3" style={{ color: 'var(--verm)' }}>{error}</div>}

          <button onClick={handleGenerate} disabled={generating || !scoreValid}
            className="btn btn-gold w-full py-3 text-sm">
            {generating ? '生成中…' : generated ? '重新生成' : '生成试卷'}
          </button>
        </div>

        {/* 右侧：预览面板 */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="section-title mb-4">试卷预览</h3>
            <div className="space-y-3" style={{ color: 'var(--ink-700)' }}>
              {[
                { label: '试卷名称', value: paperName },
                { label: '总分值', value: `${totalScore} 分` },
                { label: '题型分布', value: enabledTypes.filter(t => typeConfigs[t]?.count > 0).map(t => `${TYPE_NAMES[t]}${typeConfigs[t].count}`).join('+') || '—' },
                { label: '难度分布', value: DIFFS.map(d => `${DIFF_LABELS[DIFFS.indexOf(d)]}${difficulty[d]}%`).join(' · ') },
                { label: '来源比例', value: `专用${sourceMix}% / 公共${100 - sourceMix}%` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-dashed border-[var(--ink-100)] last:border-b-0">
                  <span style={{ color: 'var(--ink-400)' }} className="text-sm">{item.label}</span>
                  <span className="text-sm font-medium text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 生成结果 */}
          {generated && (
            <div className="card p-6">
              <h3 className="section-title mb-3">生成结果</h3>
              <div className="space-y-2 text-sm mb-4" style={{ color: 'var(--ink-700)' }}>
                <p>编号：<span className="font-medium">{generated.paperNumber}</span></p>
                <p>试题：<span className="font-medium">{generated.questions?.length || 0}</span> 题</p>
                <p>状态：<span className="tag tag-ink">草稿</span></p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleFinalize}
                  className="btn btn-ink flex-1 text-sm">直接定稿</button>
                <button onClick={() => router.push('/papers')}
                  className="btn btn-outline flex-1 text-sm">保存为草稿</button>
              </div>
            </div>
          )}

          <div className="card p-5">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-500)' }}>ⓘ 提示</p>
            <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
              生成后可在试卷管理查看完整试卷。<br />
              已引用试题设有冷却阈值，避免近期重复。
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载中…</div>}>
      <GeneratePageContent />
    </Suspense>
  );
}
