'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface Abbreviation {
  id: number;
  keyword: string;
  abbr: string;
  category: string | null;
  sortOrder: number;
}

interface CodeRules {
  separator: string;
  autoGenerate: boolean;
  includeLevel: boolean;
}

export default function OrgCodesSettingsPage() {
  const toast = useToast();
  const [rules, setRules] = useState<CodeRules | null>(null);
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // 词典编辑
  const [newKeyword, setNewKeyword] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [newCategory, setNewCategory] = useState('department');
  const [editId, setEditId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editAbbr, setEditAbbr] = useState('');

  // 预览
  const [previewName, setPreviewName] = useState('');
  const [previewParentId, setPreviewParentId] = useState<number | null>(null);
  const [previewResult, setPreviewResult] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, a, o] = await Promise.all([
        api.orgCodes.getRules(),
        api.orgCodes.getAbbreviations(),
        api.organizations.getTree(),
      ]);
      setRules(r);
      setAbbreviations(a);
      setOrgs(Array.isArray(o) ? o : []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRules = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      const updated = await api.orgCodes.updateRules(rules);
      setRules(updated);
      toast.success('编码规则已保存');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const addAbbreviation = async () => {
    if (!newKeyword || !newAbbr) { toast.warning('关键词和缩写不能为空'); return; }
    try {
      await api.orgCodes.createAbbreviation({ keyword: newKeyword, abbr: newAbbr.toUpperCase(), category: newCategory });
      setNewKeyword(''); setNewAbbr('');
      load();
      toast.success('已添加');
    } catch (e: any) { toast.error(e.message); }
  };

  const updateAbbreviation = async (id: number) => {
    try {
      await api.orgCodes.updateAbbreviation(id, { keyword: editKeyword, abbr: editAbbr.toUpperCase() });
      setEditId(null);
      load();
      toast.success('已更新');
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteAbbreviation = async (id: number, keyword: string) => {
    if (!confirm(`确认删除「${keyword}」？`)) return;
    try {
      await api.orgCodes.deleteAbbreviation(id);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doPreview = async () => {
    if (!previewName) return;
    try {
      const result = await api.orgCodes.preview(previewParentId, previewName);
      setPreviewResult(result);
    } catch (e: any) { setPreviewResult('错误: ' + e.message); }
  };

  const flattenOrgs = (nodes: any[], depth = 0): any[] => {
    const result: any[] = [];
    for (const n of nodes) {
      result.push({ ...n, depth });
      if (n.children?.length) result.push(...flattenOrgs(n.children, depth + 1));
    }
    return result;
  };

  const allOrgs = flattenOrgs(orgs);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🔤 组织编码管理</h1>
        <p className="page-subtitle">编码规则配置 · 缩写词典维护 · 编码总览</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 左栏：编码规则 ── */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold" style={{ color: 'var(--ink-600)' }}>编码规则</h2>
          {rules ? (
            <>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>层级分隔符</label>
                <input value={rules.separator} onChange={e => setRules({ ...rules, separator: e.target.value })}
                  className="input" style={{ width: 80 }} maxLength={2} />
                <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>如父=ITSS，子=CX → ITSS{rules.separator}CX</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={rules.autoGenerate} onChange={e => setRules({ ...rules, autoGenerate: e.target.checked })} id="chk-auto" />
                <label htmlFor="chk-auto" className="text-xs" style={{ color: 'var(--ink-500)' }}>创建组织时自动生成编码</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={rules.includeLevel} onChange={e => setRules({ ...rules, includeLevel: e.target.checked })} id="chk-level" />
                <label htmlFor="chk-level" className="text-xs" style={{ color: 'var(--ink-500)' }}>编码体现层级（父编码+子缩写）</label>
              </div>
              <button onClick={saveRules} disabled={saving} className="btn btn-fox btn-sm w-full">
                {saving ? '保存中…' : '💾 保存规则'}
              </button>
            </>
          ) : <p className="text-xs" style={{ color: 'var(--ink-300)' }}>加载中…</p>}

          {/* 预览工具 */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--ink-500)' }}>编码预览</h3>
            <select value={previewParentId || ''} onChange={e => setPreviewParentId(e.target.value ? Number(e.target.value) : null)}
              className="input text-xs mb-2" style={{ width: '100%' }}>
              <option value="">无父组织（顶级）</option>
              {allOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.code} - {o.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input value={previewName} onChange={e => setPreviewName(e.target.value)} placeholder="输入组织名称"
                className="input text-xs flex-1" onKeyDown={e => e.key === 'Enter' && doPreview()} />
              <button onClick={doPreview} className="btn btn-outline btn-sm">预览</button>
            </div>
            {previewResult && (
              <div className="mt-2 p-2 rounded text-sm font-mono font-bold" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
                {previewResult}
              </div>
            )}
          </div>
        </div>

        {/* ── 中栏：缩写词典 ── */}
        <div className="card p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--ink-600)' }}>缩写词典（{abbreviations.length}）</h2>
          <div className="max-h-[420px] overflow-y-auto space-y-1 mb-4">
            {abbreviations.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded" style={{ background: 'var(--paper)' }}>
                {editId === a.id ? (
                  <>
                    <input value={editKeyword} onChange={e => setEditKeyword(e.target.value)} className="input text-xs" style={{ width: 80, padding: '2px 6px' }} />
                    <input value={editAbbr} onChange={e => setEditAbbr(e.target.value)} className="input text-xs" style={{ width: 60, padding: '2px 6px' }} />
                    <button onClick={() => updateAbbreviation(a.id)} className="btn btn-fox btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>✓</button>
                    <button onClick={() => setEditId(null)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>✕</button>
                  </>
                ) : (
                  <>
                    <span className="font-medium flex-1" style={{ color: 'var(--ink-600)' }}>{a.keyword}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--gold)' }}>{a.abbr}</span>
                    <span className="tag tag-ink" style={{ fontSize: 9 }}>{a.category || '—'}</span>
                    <button onClick={() => { setEditId(a.id); setEditKeyword(a.keyword); setEditAbbr(a.abbr); }}
                      className="bg-transparent border-none cursor-pointer text-xs" style={{ color: 'var(--ink-300)' }}>✎</button>
                    <button onClick={() => deleteAbbreviation(a.id, a.keyword)}
                      className="bg-transparent border-none cursor-pointer text-xs" style={{ color: 'var(--ink-300)' }}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
          {/* 新增行 */}
          <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
            <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="关键词" className="input text-xs" style={{ width: 80, padding: '4px 8px' }} />
            <input value={newAbbr} onChange={e => setNewAbbr(e.target.value)} placeholder="缩写" className="input text-xs" style={{ width: 60, padding: '4px 8px' }} />
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="input text-xs" style={{ width: 90, padding: '4px 6px' }}>
              <option value="department">部门</option>
              <option value="business">业务</option>
              <option value="region">地区</option>
            </select>
            <button onClick={addAbbreviation} className="btn btn-gold btn-sm" style={{ padding: '4px 10px' }}>＋</button>
          </div>
        </div>

        {/* ── 右栏：编码总览 ── */}
        <div className="card p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--ink-600)' }}>编码总览（{allOrgs.length}）</h2>
          <div className="max-h-[500px] overflow-y-auto space-y-0.5">
            {allOrgs.map(o => (
              <div key={o.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded" style={{ paddingLeft: 8 + o.depth * 16 }}>
                <span className="font-mono font-bold" style={{ color: 'var(--cyan)', minWidth: 100 }}>{o.code}</span>
                <span style={{ color: 'var(--ink-500)' }}>{o.name}</span>
                <span className="tag tag-ink ml-auto" style={{ fontSize: 9 }}>{o.orgType}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
