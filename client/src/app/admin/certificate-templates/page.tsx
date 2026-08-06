'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { TEMPLATE_PRESETS, type TemplatePreset } from '@/lib/canvas-renderer/template-presets';
import { renderCanvasToHtml } from '@/lib/canvas-renderer/renderer';
import type { TemplateData } from '@/lib/canvas-renderer/types';

interface TemplateItem {
  id: number;
  name: string;
  type: string;
  description: string | null;
  thumbnail: string | null;
  isDefault: boolean;
  isActive: boolean;
  orgId: number | null;
  createdBy: number;
  creatorName?: string;
  usageCount?: number;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

const PRESET_PREVIEW_DATA: TemplateData = {
  studentName: '张三', courseName: '人工智能应用', certificateNo: 'CERT-2026-001',
  issueDate: '2026-07-31', orgName: '示例机构', totalHours: 48,
  startDate: '2026-01-01', endDate: '2026-06-30', idCardMasked: '110***1234',
};

// 类型元信息：标签文字 + 柔和配色（与证书语义呼应）
const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETION: { label: '结业证书', color: 'var(--blue)', bg: 'var(--info-pale)' },
  HOURS: { label: '学时证明', color: 'var(--sage)', bg: 'var(--success-pale)' },
  CUSTOM: { label: '自定义', color: 'var(--purple)', bg: 'var(--info-pale)' },
};
const typeMeta = (t: string) => TYPE_META[t] || { label: t, color: 'var(--ink-500)', bg: 'var(--ink-50)' };

const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'createdAt', label: '最新创建' },
  { value: 'name', label: '名称 A→Z' },
];

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function CertificateTemplatesPage() {
  const router = useRouter();
  const toast = useToast();

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | active | inactive
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewTpl, setPreviewTpl] = useState<TemplateItem | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState('');

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sortBy !== 'default') params.set('sortBy', sortBy);
      const res = await fetch(`/api/certificate-templates?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('加载失败');
      setTemplates(await res.json());
    } catch {
      toast.error('加载模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); /* eslint-disable-next-line */ }, [search, sortBy]);

  // 类型计数（基于服务端搜索/排序后的集合）
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of templates) c[t.type] = (c[t.type] || 0) + 1;
    return c;
  }, [templates]);

  // 客户端再做类型 + 状态过滤（数据量小，响应更快）
  const visible = useMemo(() => templates.filter(t => {
    if (filterType && t.type !== filterType) return false;
    if (filterStatus === 'active' && !t.isActive) return false;
    if (filterStatus === 'inactive' && t.isActive) return false;
    return true;
  }), [templates, filterType, filterStatus]);

  const hasFilters = !!(search || filterType || filterStatus);

  // ── 操作 ──
  const handleDelete = async (id: number) => {
    if (!confirm('确定停用此模板？停用后将不可用于新证书发放。')) return;
    const res = await fetch(`/api/certificate-templates/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { toast.success('已停用'); setPreviewTpl(null); fetchTemplates(); }
    else toast.error('操作失败');
  };

  const handleDuplicate = async (id: number) => {
    const res = await fetch(`/api/certificate-templates/${id}/duplicate`, { method: 'POST', headers: authHeaders() });
    if (res.ok) { toast.success('已复制为新模板'); fetchTemplates(); }
    else toast.error('复制失败');
  };

  const handleSetDefault = async (id: number) => {
    const res = await fetch(`/api/certificate-templates/${id}/set-default`, { method: 'POST', headers: authHeaders() });
    if (res.ok) { toast.success('已设为默认模板'); fetchTemplates(); }
    else toast.error('操作失败');
  };

  const handleRegenThumb = async (id: number) => {
    const res = await fetch(`/api/certificate-templates/${id}/regenerate-thumbnail`, { method: 'POST', headers: authHeaders() });
    if (res.ok) { toast.success('缩略图已刷新'); fetchTemplates(); }
    else toast.error('刷新失败');
  };

  const handleCreate = () => router.push('/admin/certificate-templates/editor');

  const handleCreateFromPreset = async (preset: TemplatePreset) => {
    setCreatingPreset(preset.key);
    try {
      const res = await fetch('/api/certificate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: preset.name,
          type: preset.key === 'hours' ? 'HOURS' : 'COMPLETION',
          description: preset.description,
          canvasJson: preset.canvas,
        }),
      });
      if (!res.ok) throw new Error('创建失败');
      const saved = await res.json();
      toast.success('已从模板创建');
      router.push(`/admin/certificate-templates/editor?id=${saved.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setCreatingPreset(''); }
  };

  const openEditor = (id: number) => router.push(`/admin/certificate-templates/editor?id=${id}`);
  const openBatch = (id: number) => router.push(`/admin/certificate-templates/batch?id=${id}`);

  // ── 类型筛选 chips ──
  const typeChips = [
    { key: '', label: '全部', count: templates.length },
    ...Object.keys(TYPE_META).map(k => ({ key: k, label: TYPE_META[k].label, count: typeCounts[k] || 0 })),
  ];

  return (
    <AppLayout>
      <style>{`
        .ct-card { position: relative; background: var(--color-paper-bright); border: 1px solid var(--color-ink-100);
          border-radius: var(--radius-card); overflow: hidden; transition: box-shadow .18s, transform .18s, border-color .18s; }
        .ct-card:hover { box-shadow: var(--shadow-md); transform: translateY(-3px); border-color: var(--color-ink-200); }
        .ct-thumb { position: relative; aspect-ratio: 1123 / 794;
          background: linear-gradient(135deg, var(--paper-alt) 0%, var(--paper-dark) 100%);
          display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
        .ct-thumb img { width: 100%; height: 100%; object-fit: contain; box-shadow: 0 1px 6px rgba(26,23,18,.18); }
        .ct-overlay { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; gap: 8px;
          padding: 12px; background: linear-gradient(to top, rgba(26,23,18,.55), rgba(26,23,18,0) 55%);
          opacity: 0; pointer-events: none; transition: opacity .18s; }
        .ct-card:hover .ct-overlay { opacity: 1; pointer-events: auto; }
        .ct-ovbtn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: .74rem; font-weight: 500;
          color: var(--color-ink-800); background: rgba(250,246,239,.95); border: none; border-radius: 8px; cursor: pointer;
          backdrop-filter: blur(2px); transition: background .15s, color .15s; }
        .ct-ovbtn:hover { background: var(--color-fox); color: #fff; }
        .ct-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; font-size: .8rem; font-weight: 500;
          color: var(--color-ink-400); background: transparent; border: 1px solid var(--color-ink-100); border-radius: 999px;
          cursor: pointer; transition: all .15s; white-space: nowrap; }
        .ct-chip:hover { border-color: var(--color-fox); color: var(--color-fox-dark); }
        .ct-chip.on { background: var(--color-ink-900); border-color: var(--color-ink-900); color: var(--color-paper-bright); }
        .ct-chip .n { font-size: .7rem; opacity: .65; }
        .ct-vtoggle { display: inline-flex; border: 1px solid var(--color-ink-100); border-radius: 8px; overflow: hidden; }
        .ct-vbtn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: transparent;
          border: none; cursor: pointer; color: var(--color-ink-300); transition: all .15s; }
        .ct-vbtn.on { background: var(--color-ink-900); color: var(--color-paper-bright); }
        .ct-badge { position: absolute; top: 10px; font-size: .68rem; font-weight: 600; padding: 3px 9px; border-radius: 999px;
          backdrop-filter: blur(2px); z-index: 2; }
        .ct-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--color-paper-bright);
          border: 1px solid var(--color-ink-100); border-radius: 10px; transition: box-shadow .15s, border-color .15s; }
        .ct-row:hover { box-shadow: var(--shadow-sm); border-color: var(--color-ink-200); }
        .ct-act { padding: 5px 11px; font-size: .76rem; background: transparent; border: 1px solid var(--color-ink-100);
          border-radius: 7px; cursor: pointer; color: var(--color-ink-500); transition: all .15s; }
        .ct-act:hover { border-color: var(--color-fox); color: var(--color-fox-dark); }
        .ct-act.danger:hover { border-color: var(--color-verm); color: var(--color-verm); }
      `}</style>

      <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
        {/* ═══ 页头 ═══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 className="page-title">📜 证书模板管理</h1>
            <p className="page-subtitle">设计与制作结业证书、学时证明的版式模板，支持批量发证</p>
          </div>
          <button onClick={() => setShowPresetModal(true)} className="btn btn-outline btn-sm">📋 从模板创建</button>
          <button onClick={handleCreate} className="btn btn-fox btn-sm">＋ 空白新建</button>
        </div>

        {/* ═══ 工具栏 ═══ */}
        <div className="card" style={{ padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 搜索 */}
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: .5 }}>🔍</span>
              <input
                className="input"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索模板名称或描述…"
                style={{ paddingLeft: 34, paddingRight: searchInput ? 30 : 14, height: 38 }}
              />
              {searchInput && (
                <button onClick={() => setSearchInput('')} title="清除"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-300)', fontSize: 14 }}>✕</button>
              )}
            </div>
            {/* 状态 */}
            <select className="input select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 130, height: 38 }}>
              <option value="">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已停用</option>
            </select>
            {/* 排序 */}
            <select className="input select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 140, height: 38 }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {/* 视图切换 */}
            <div className="ct-vtoggle">
              <button className={`ct-vbtn ${viewMode === 'grid' ? 'on' : ''}`} onClick={() => setViewMode('grid')} title="网格视图">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              </button>
              <button className={`ct-vbtn ${viewMode === 'list' ? 'on' : ''}`} onClick={() => setViewMode('list')} title="列表视图">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2.4" rx="1"/><rect x="1" y="6.8" width="14" height="2.4" rx="1"/><rect x="1" y="11.6" width="14" height="2.4" rx="1"/></svg>
              </button>
            </div>
          </div>

          {/* 类型 chips + 计数 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {typeChips.map(c => (
              <button key={c.key} className={`ct-chip ${filterType === c.key ? 'on' : ''}`} onClick={() => setFilterType(c.key)}>
                {c.label}<span className="n">{c.count}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--color-ink-300)' }}>
              共 <b className="text-[var(--color-ink-600)]">{visible.length}</b> 个模板
            </span>
          </div>
        </div>

        {/* ═══ 内容区 ═══ */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 70, color: 'var(--color-ink-300)' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }} className="animate-pulse-fast">📜</div>
            加载中…
          </div>
        ) : visible.length === 0 ? (
          /* 空状态 */
          <div style={{ textAlign: 'center', padding: '70px 20px', background: 'var(--color-paper-bright)', border: '1px dashed var(--color-ink-100)', borderRadius: 14 }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: .8 }}>{hasFilters ? '🔍' : '📜'}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink-600)', margin: '0 0 6px' }}>
              {hasFilters ? '没有匹配的模板' : '还没有证书模板'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-ink-300)', margin: '0 0 18px' }}>
              {hasFilters ? '试试调整搜索关键词或筛选条件' : '从内置模板快速开始，或空白新建自由设计'}
            </p>
            {hasFilters ? (
              <button className="btn btn-outline btn-sm" onClick={() => { setSearchInput(''); setFilterType(''); setFilterStatus(''); }}>清除全部筛选</button>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowPresetModal(true)}>📋 从模板创建</button>
                <button className="btn btn-fox btn-sm" onClick={handleCreate}>＋ 空白新建</button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ── 网格视图 ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 18 }}>
            {visible.map(tpl => {
              const m = typeMeta(tpl.type);
              return (
                <div key={tpl.id} className="ct-card" style={{ opacity: tpl.isActive ? 1 : 0.62 }}>
                  {/* 缩略图 */}
                  <div className="ct-thumb" onClick={() => setPreviewTpl(tpl)}>
                    <span className="ct-badge" style={{ left: 10, background: m.bg, color: m.color }}>{m.label}</span>
                    {tpl.isSystem && <span className="ct-badge" style={{ left: 10, top: 38, background: 'rgba(58,54,48,.88)', color: '#fff' }}>🔒 系统内置</span>}
                    {tpl.isDefault && <span className="ct-badge" style={{ right: 10, background: 'rgba(201,160,58,.92)', color: '#fff' }}>★ 默认</span>}
                    {!tpl.isActive && <span className="ct-badge" style={{ right: tpl.isDefault ? 64 : 10, background: 'rgba(90,83,72,.85)', color: '#fff' }}>已停用</span>}
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} alt={tpl.name} />
                    ) : (
                      <span style={{ color: 'var(--color-ink-200)', fontSize: 13 }}>暂无缩略图</span>
                    )}
                    {/* hover 快捷操作 */}
                    <div className="ct-overlay" onClick={e => e.stopPropagation()}>
                      <button className="ct-ovbtn" onClick={() => setPreviewTpl(tpl)}>👁 预览</button>
                      <button className="ct-ovbtn" onClick={() => openEditor(tpl.id)}>✏️ 编辑</button>
                      <button className="ct-ovbtn" onClick={() => openBatch(tpl.id)}>📦 批量</button>
                    </div>
                  </div>
                  {/* 信息 */}
                  <div style={{ padding: '12px 14px 13px' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 600, color: 'var(--color-ink-800)', fontFamily: 'var(--font-serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</h4>
                    <p style={{ margin: '0 0 9px', fontSize: 12, color: 'var(--color-ink-300)', height: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tpl.description || '暂无描述'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--color-ink-300)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {tpl.creatorName || `用户#${tpl.createdBy}`}</span>
                      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span title="使用次数（已签发证书数）" style={{ color: (tpl.usageCount ?? 0) > 0 ? 'var(--color-fox)' : undefined }}>📄 {tpl.usageCount ?? 0}</span>
                        <span>{fmtDate(tpl.updatedAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 列表视图 ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(tpl => {
              const m = typeMeta(tpl.type);
              return (
                <div key={tpl.id} className="ct-row" style={{ opacity: tpl.isActive ? 1 : 0.62 }}>
                  <div onClick={() => setPreviewTpl(tpl)}
                    style={{ width: 92, height: 65, flexShrink: 0, borderRadius: 7, overflow: 'hidden', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--color-ink-100)' }}>
                    {tpl.thumbnail ? <img src={tpl.thumbnail} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: 'var(--color-ink-200)' }}>无图</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-ink-800)', fontFamily: 'var(--font-serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</span>
                      <span className="tag" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                      {tpl.isDefault && <span className="tag tag-gold">★ 默认</span>}
                      {tpl.isSystem && <span className="tag tag-ink">🔒 系统内置</span>}
                      {!tpl.isActive && <span className="tag tag-ink">已停用</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-ink-300)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tpl.description || '暂无描述'} · 👤 {tpl.creatorName || `用户#${tpl.createdBy}`} · {tpl.orgId ? `组织#${tpl.orgId}` : '平台级'} · 📄 {tpl.usageCount ?? 0} 次使用 · 更新于 {fmtDate(tpl.updatedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button className="ct-act" onClick={() => openEditor(tpl.id)}>编辑</button>
                    <button className="ct-act" onClick={() => openBatch(tpl.id)}>批量</button>
                    <button className="ct-act" onClick={() => handleDuplicate(tpl.id)}>复制</button>
                    {!tpl.isDefault && tpl.isActive && <button className="ct-act" onClick={() => handleSetDefault(tpl.id)}>设为默认</button>}
                    {tpl.isActive && !tpl.isSystem && <button className="ct-act danger" onClick={() => handleDelete(tpl.id)}>停用</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 快速预览弹窗 ═══ */}
        {previewTpl && (
          <div className="modal-overlay" onClick={() => setPreviewTpl(null)}>
            <div className="modal-card" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)', color: 'var(--color-ink-800)' }}>{previewTpl.name}</h3>
                  <span className="tag" style={{ background: typeMeta(previewTpl.type).bg, color: typeMeta(previewTpl.type).color }}>{typeMeta(previewTpl.type).label}</span>
                  {previewTpl.isDefault && <span className="tag tag-gold">★ 默认</span>}
                  {previewTpl.isSystem && <span className="tag tag-ink">🔒 系统内置</span>}
                  {!previewTpl.isActive && <span className="tag tag-ink">已停用</span>}
                </div>
                <button onClick={() => setPreviewTpl(null)} className="btn btn-ghost btn-icon">✕</button>
              </div>
              <div className="modal-body">
                <div style={{ background: 'linear-gradient(135deg, #e7e1d3 0%, #dcd5c5 100%)', border: '1px solid var(--color-ink-100)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'center' }}>
                  {previewTpl.thumbnail ? (
                    <img src={previewTpl.thumbnail} alt={previewTpl.name} style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 4 }} />
                  ) : (
                    <div style={{ padding: '60px 0', color: 'var(--color-ink-200)' }}>暂无缩略图</div>
                  )}
                </div>
                {previewTpl.description && <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--color-ink-500)' }}>{previewTpl.description}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px', marginTop: 14, fontSize: 12.5, color: 'var(--color-ink-400)' }}>
                  <div>👤 创建者：{previewTpl.creatorName || `用户#${previewTpl.createdBy}`}</div>
                  <div>🏢 归属：{previewTpl.orgId ? `组织 #${previewTpl.orgId}` : '平台级模板'}</div>
                  <div>🕐 创建时间：{fmtDate(previewTpl.createdAt)}</div>
                  <div>🔄 更新时间：{fmtDate(previewTpl.updatedAt)}</div>
                  <div>📄 使用次数：{previewTpl.usageCount ?? 0} 次</div>
                </div>
              </div>
              <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRegenThumb(previewTpl.id)}>🔄 刷新缩略图</button>
                <div style={{ flex: 1 }} />
                <button className="btn btn-outline btn-sm" onClick={() => handleDuplicate(previewTpl.id)}>复制</button>
                {!previewTpl.isDefault && previewTpl.isActive && <button className="btn btn-outline btn-sm" onClick={() => handleSetDefault(previewTpl.id)}>设为默认</button>}
                <button className="btn btn-outline btn-sm" onClick={() => openBatch(previewTpl.id)}>📦 批量生成</button>
                <button className="btn btn-fox btn-sm" onClick={() => openEditor(previewTpl.id)}>✏️ 编辑模板</button>
                {previewTpl.isActive && !previewTpl.isSystem && <button className="btn btn-verm btn-sm" onClick={() => handleDelete(previewTpl.id)}>停用</button>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 从模板创建弹窗 ═══ */}
        {showPresetModal && (
          <div className="modal-overlay" onClick={() => setShowPresetModal(false)}>
            <div className="modal-card" style={{ maxWidth: 880 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)', color: 'var(--color-ink-800)' }}>从模板创建</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--color-ink-300)' }}>选择一个内置版式，快速开始设计</p>
                </div>
                <button onClick={() => setShowPresetModal(false)} className="btn btn-ghost btn-icon">✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 16 }}>
                  {/* 空白模板 */}
                  <div onClick={handleCreate} className="ct-card" style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
                    <div style={{ aspectRatio: '1123 / 794', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, color: 'var(--color-ink-200)' }}>＋</div>
                    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-ink-100)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink-800)' }}>空白模板</div>
                      <div style={{ fontSize: 12, color: 'var(--color-ink-300)', marginTop: 2 }}>从零开始自由设计</div>
                    </div>
                  </div>
                  {/* 内置预设 */}
                  {TEMPLATE_PRESETS.map(preset => (
                    <div key={preset.key} onClick={() => !creatingPreset && handleCreateFromPreset(preset)} className="ct-card"
                      style={{ cursor: creatingPreset ? 'wait' : 'pointer', opacity: creatingPreset && creatingPreset !== preset.key ? 0.5 : 1 }}>
                      <div style={{ aspectRatio: '1123 / 794', overflow: 'hidden', position: 'relative', background: 'var(--neutral-100)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                        <div style={{ transform: 'scale(0.21)', transformOrigin: 'top center', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderCanvasToHtml(preset.canvas, PRESET_PREVIEW_DATA) }} />
                        {creatingPreset === preset.key && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,246,239,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--color-fox-dark)' }}>创建中…</div>
                        )}
                      </div>
                      <div style={{ padding: '10px 14px', borderTop: `3px solid ${preset.accent}` }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink-800)' }}>{preset.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-ink-300)', marginTop: 2 }}>{preset.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
