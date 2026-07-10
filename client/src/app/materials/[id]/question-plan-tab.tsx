'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const TYPE_OPTIONS = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'TRUE_FALSE', label: '判断题' },
  { value: 'SHORT_ANSWER', label: '简答题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
];

interface Chapter {
  id: number;
  title: string;
  contentLength: number;
  sortOrder: number;
}

interface PlanConfig {
  chapterId: number;
  type: string;
  count: number;
  difficultyEasy: number;
  difficultyMedium: number;
  difficultyHard: number;
  focusKeywords: string;
  _enabled?: boolean;
}

export default function QuestionPlanTab({
  materialId,
  materialStatus,
  chapters,
  onGenerate,
}: {
  materialId: number;
  materialStatus: string;
  chapters: Chapter[];
  onGenerate: () => void;
}) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [configs, setConfigs] = useState<PlanConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<number | null>(null);
  const [execProgress, setExecProgress] = useState<any>(null);
  const [batchNoteLoading, setBatchNoteLoading] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.materials.getQuestionPlans(materialId);
      setPlans(data);
    } catch {}
    setLoading(false);
  }, [materialId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // ── 初始化新建表单 ──
  const initNewForm = () => {
    const initial: PlanConfig[] = [];
    for (const ch of chapters) {
      if (!ch.contentLength) continue; // 跳过无内容的章节
      for (const type of TYPE_OPTIONS) {
        initial.push({
          chapterId: ch.id,
          type: type.value,
          count: 0,
          difficultyEasy: 30,
          difficultyMedium: 50,
          difficultyHard: 20,
          focusKeywords: '',
          _enabled: false,
        });
      }
    }
    setConfigs(initial);
    setShowNewForm(true);
  };

  // ── 切换章节/题型的启用状态 ──
  const toggleConfig = (idx: number) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, _enabled: !c._enabled, count: !c._enabled ? 1 : 0 } : c));
  };

  // ── 更新配置值 ──
  const updateConfig = (idx: number, field: string, value: any) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  // ── 统计 ──
  const enabledConfigs = configs.filter(c => c._enabled && c.count > 0);
  const totalByType = (type: string) => enabledConfigs.filter(c => c.type === type).reduce((s, c) => s + c.count, 0);
  const totalQuestions = enabledConfigs.reduce((s, c) => s + c.count, 0);

  // ── 保存出题计划 ──
  const handleSave = async (andExecute = false) => {
    const validConfigs = configs
      .filter(c => c._enabled && c.count > 0)
      .map(c => ({
        chapterId: c.chapterId,
        type: c.type,
        count: c.count,
        difficultyEasy: c.difficultyEasy,
        difficultyMedium: c.difficultyMedium,
        difficultyHard: c.difficultyHard,
        focusKeywords: c.focusKeywords || undefined,
      }));

    if (validConfigs.length === 0) { alert('请至少为一道题配置出题项'); return; }

    setSaving(true);
    try {
      const plan = await api.materials.createQuestionPlan(materialId, { configs: validConfigs });
      setShowNewForm(false);
      await loadPlans();
      if (andExecute) {
        await handleExecute(plan.id);
      }
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  // ── 执行出题计划 ──
  const handleExecute = async (planId: number) => {
    setExecutingPlanId(planId);
    setExecProgress({ planStatus: 'EXECUTING', totalConfigs: 0, completedConfigs: 0, failedConfigs: 0, totalQuestions: 0, generatedQuestions: 0 });

    try {
      // 启动执行（不等待完成）
      api.materials.executeQuestionPlan(materialId, planId).then(result => {
        setExecProgress((prev: any) => ({ ...prev, ...result, planStatus: 'COMPLETED' }));
        setExecutingPlanId(null);
        onGenerate();
      }).catch(e => {
        alert('出题失败：' + e.message);
        setExecutingPlanId(null);
      });

      // 轮询进度
      const poll = setInterval(async () => {
        try {
          const progress = await api.materials.getPlanProgress(materialId, planId);
          setExecProgress(progress);
          if (progress.planStatus === 'COMPLETED' || progress.planStatus === 'FAILED') {
            clearInterval(poll);
            if (progress.planStatus === 'COMPLETED') {
              await loadPlans();
              onGenerate();
            }
          }
        } catch {}
      }, 3000);
    } catch (e: any) { alert('启动失败：' + e.message); setExecutingPlanId(null); }
  };

  // ── 从 batchNote 快速出题 ──
  const handleBatchNoteGenerate = async () => {
    if (!confirm('使用教材出题要求(batchNote)自动生成出题计划并执行？将覆盖现有试题。')) return;
    setBatchNoteLoading(true);
    try {
      const result = await api.materials.generateFromBatchNote(materialId);
      alert(`出题完成！生成了 ${result.total} 道试题（${result.chapters} 个章节）`);
      await loadPlans();
      onGenerate();
    } catch (e: any) { alert('出题失败：' + e.message); }
    setBatchNoteLoading(false);
  };

  // ── 执行进度展示 ──
  const renderProgress = () => {
    if (!execProgress) return null;
    const pct = execProgress.totalQuestions > 0
      ? Math.round((execProgress.generatedQuestions / execProgress.totalQuestions) * 100)
      : 0;

    return (
      <div className="card p-6 mb-4" style={{ borderColor: 'var(--gold)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="animate-pulse">🤖</span>
          <span className="text-sm font-medium">出题计划执行中…</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--paper-dark)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--fox), var(--gold))',
          }} />
        </div>
        <div className="flex justify-between text-xs" style={{ color: 'var(--ink-400)' }}>
          <span>{execProgress.generatedQuestions}/{execProgress.totalQuestions} 题</span>
          <span>{execProgress.completedConfigs}/{execProgress.totalConfigs} 配置</span>
          {execProgress.failedConfigs > 0 && (
            <span style={{ color: 'var(--verm)' }}>{execProgress.failedConfigs} 失败</span>
          )}
        </div>
      </div>
    );
  };

  if (loading && plans.length === 0) {
    return <div className="text-center py-10" style={{ color: 'var(--ink-300)' }}>加载中…</div>;
  }

  return (
    <div>
      {/* 指引文案 */}
      {materialStatus === 'STRUCTURED' && plans.length === 0 && !showNewForm && (
        <div className="p-4 mb-4 rounded-lg text-sm" style={{ background: 'var(--cyan-glow)', color: 'var(--cyan)', border: '1px solid var(--cyan)' }}>
          ✅ 教材结构已确认，点击下方「新建出题计划」开始配置各章节的题型和题量 →
        </div>
      )}
      {materialStatus !== 'STRUCTURED' && materialStatus !== 'GENERATED' && materialStatus !== 'REVIEWING' && materialStatus !== 'COMPLETED' && (
        <div className="p-4 mb-4 rounded-lg text-sm" style={{ background: 'var(--fox-pale)', color: 'var(--fox-dark)', border: '1px solid var(--fox-glow)' }}>
          ℹ️ 请先在「📖 章节结构」Tab 中确认章节结构后再进行出题配置
        </div>
      )}

      {/* 执行进度 */}
      {executingPlanId && renderProgress()}

      {/* 已有计划列表 */}
      {plans.length > 0 && !showNewForm && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium" style={{ color: 'var(--ink-500)' }}>已保存的出题计划</h3>
          {plans.map((plan: any) => {
            const planTotal = plan.configs?.reduce((s: number, c: any) => s + c.count, 0) || 0;
            const typeSummary = TYPE_OPTIONS.map(t => {
              const c = plan.configs?.filter((cfg: any) => cfg.type === t.value).reduce((s: number, cfg: any) => s + cfg.count, 0) || 0;
              return c > 0 ? `${t.label}${c}题` : '';
            }).filter(Boolean).join(' + ');
            const canExecute = plan.status === 'DRAFT';

            return (
              <div key={plan.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{plan.name || '未命名计划'}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                    {typeSummary} = {planTotal} 题
                    &nbsp;·&nbsp;
                    <span style={{
                      color: plan.status === 'COMPLETED' ? 'var(--cyan)' : plan.status === 'EXECUTING' ? 'var(--gold)' : 'var(--ink-400)',
                    }}>
                      {plan.status === 'DRAFT' ? '草稿' : plan.status === 'EXECUTING' ? '执行中' : plan.status === 'COMPLETED' ? '已完成' : '失败'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canExecute && (
                    <button onClick={() => handleExecute(plan.id)} disabled={executingPlanId !== null}
                      className="btn btn-fox btn-xs">
                      {executingPlanId === plan.id ? '执行中…' : '▶ 执行'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新建表单 */}
      {showNewForm ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>新建出题计划</h3>
            <button onClick={() => setShowNewForm(false)} className="btn btn-ghost btn-xs">取消</button>
          </div>

          {/* 章节 × 题型配置 */}
          <div className="space-y-3 mb-5">
            {chapters.filter(ch => ch.contentLength > 0).map((ch, ci) => (
              <div key={ch.id} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs" style={{ color: 'var(--ink-300)' }}>{ci + 1}.</span>
                  <span className="text-sm font-medium">{ch.title}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>
                    {(ch.contentLength / 1000).toFixed(1)}k 字
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                  {TYPE_OPTIONS.map((type) => {
                    const idx = configs.findIndex(c => c.chapterId === ch.id && c.type === type.value);
                    const cfg = configs[idx];
                    if (!cfg) return null;
                    return (
                      <div key={type.value}
                        className={`p-2 rounded-lg text-xs transition-all ${cfg._enabled ? '' : 'opacity-50'}`}
                        style={{
                          background: cfg._enabled ? 'var(--fox-pale)' : 'var(--paper)',
                          border: `1px solid ${cfg._enabled ? 'var(--fox-glow)' : 'var(--ink-100)'}`,
                        }}>
                        <label className="flex items-center gap-1.5 cursor-pointer mb-1.5">
                          <input type="checkbox" checked={cfg._enabled} onChange={() => toggleConfig(idx)}
                            className="cursor-pointer" style={{ accentColor: '#e87a30' }} />
                          <span className="font-medium">{type.label}</span>
                        </label>
                        {cfg._enabled && (
                          <div className="space-y-1.5 pl-5">
                            <div className="flex items-center gap-2">
                              <span className="w-6" style={{ color: 'var(--ink-400)' }}>题数</span>
                              <input type="number" min={0} max={30} value={cfg.count}
                                onChange={e => updateConfig(idx, 'count', Math.max(0, Math.min(30, Number(e.target.value))))}
                                className="input text-xs" style={{ width: '50px' }} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-6" style={{ color: 'var(--ink-400)' }}>难</span>
                              <input type="number" min={0} max={100} value={cfg.difficultyEasy}
                                onChange={e => updateConfig(idx, 'difficultyEasy', Number(e.target.value))}
                                className="input text-xs" style={{ width: '40px' }} />
                              <span className="w-6 text-center" style={{ color: 'var(--ink-400)' }}>中</span>
                              <input type="number" min={0} max={100} value={cfg.difficultyMedium}
                                onChange={e => updateConfig(idx, 'difficultyMedium', Number(e.target.value))}
                                className="input text-xs" style={{ width: '40px' }} />
                              <span className="w-6 text-center" style={{ color: 'var(--ink-400)' }}>难</span>
                              <input type="number" min={0} max={100} value={cfg.difficultyHard}
                                onChange={e => updateConfig(idx, 'difficultyHard', Number(e.target.value))}
                                className="input text-xs" style={{ width: '40px' }} />
                            </div>
                            <input type="text" value={cfg.focusKeywords} placeholder="重点关注（可选）"
                              onChange={e => updateConfig(idx, 'focusKeywords', e.target.value)}
                              className="input text-xs" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 总计预览 */}
          <div className="card p-4 mb-4" style={{ background: 'var(--paper-50)' }}>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {TYPE_OPTIONS.map(t => {
                  const c = totalByType(t.value);
                  return c > 0 ? <span key={t.value} className="mr-3">{t.label} {c}题</span> : null;
                })}
                <span className="font-bold" style={{ color: 'var(--fox)' }}>共 {totalQuestions} 题</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="btn btn-outline btn-sm">
                  {saving ? '保存中…' : '💾 保存出题计划'}
                </button>
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="btn btn-fox btn-sm">
                  {saving ? '保存中…' : '🚀 保存并执行'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={initNewForm}
            className="btn btn-fox">
            + 新建出题计划
          </button>
          <button onClick={handleBatchNoteGenerate} disabled={batchNoteLoading}
            className="btn btn-outline btn-sm">
            {batchNoteLoading ? '执行中…' : '🤖 旧版快速出题'}
          </button>
        </div>
      )}
    </div>
  );
}
