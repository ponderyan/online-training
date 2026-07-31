'use client';

import { useEffect, useState } from 'react';
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
  createdAt: string;
  updatedAt: string;
}

const PRESET_PREVIEW_DATA: TemplateData = {
  studentName: '张三', courseName: '人工智能应用', certificateNo: 'CERT-2026-001',
  issueDate: '2026-07-31', orgName: '示例机构', totalHours: 48,
  startDate: '2026-01-01', endDate: '2026-06-30', idCardMasked: '110***1234',
};

const TYPE_LABELS: Record<string, string> = {
  COMPLETION: '结业证书',
  HOURS: '学时证明',
  CUSTOM: '自定义',
};

const TYPE_COLORS: Record<string, string> = {
  COMPLETION: '#1565c0',
  HOURS: '#2e7d32',
  CUSTOM: '#7b1fa2',
};

export default function CertificateTemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      const res = await fetch(`/api/certificate-templates?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('加载失败');
      setTemplates(await res.json());
    } catch (err) {
      toast.error('加载模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [filterType]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定停用此模板？')) return;
    const res = await fetch(`/api/certificate-templates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (res.ok) {
      toast.success('已停用');
      fetchTemplates();
    } else {
      toast.error('操作失败');
    }
  };

  const handleDuplicate = async (id: number) => {
    const res = await fetch(`/api/certificate-templates/${id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (res.ok) {
      toast.success('已复制');
      fetchTemplates();
    } else {
      toast.error('复制失败');
    }
  };

  const handleSetDefault = async (id: number) => {
    const res = await fetch(`/api/certificate-templates/${id}/set-default`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (res.ok) {
      toast.success('已设为默认');
      fetchTemplates();
    }
  };

  const handleCreate = () => {
    router.push('/admin/certificate-templates/editor');
  };

  const handleCreateFromPreset = async (preset: TemplatePreset) => {
    setCreatingPreset(preset.key);
    try {
      const res = await fetch('/api/certificate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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

  return (
    <AppLayout>
      <div style={{ padding: 24 }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>证书模板管理</h2>
          <div style={{ flex: 1 }} />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ marginRight: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd' }}
          >
            <option value="">全部类型</option>
            <option value="COMPLETION">结业证书</option>
            <option value="HOURS">学时证明</option>
            <option value="CUSTOM">自定义</option>
          </select>
          <button onClick={() => setShowPresetModal(true)} className="btn btn-sm" style={{ background: '#fff', color: '#e87d30', border: '1px solid #e87d30', padding: '8px 16px', borderRadius: 6, marginRight: 8, cursor: 'pointer' }}>
            📋 从模板创建
          </button>
          <button onClick={handleCreate} className="btn btn-sm" style={{ background: '#e87d30', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            + 空白新建
          </button>
        </div>

        {/* 列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📜</p>
            <p>暂无证书模板</p>
            <button onClick={handleCreate} style={{ marginTop: 12, padding: '8px 20px', background: '#e87d30', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              创建第一个模板
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {templates.map(tpl => (
              <div
                key={tpl.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'box-shadow 0.2s',
                  opacity: tpl.isActive ? 1 : 0.5,
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* 缩略图区 */}
                <div
                  style={{ height: 160, background: '#f5f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => router.push(`/admin/certificate-templates/editor?id=${tpl.id}`)}
                >
                  {tpl.thumbnail ? (
                    <img src={tpl.thumbnail} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ color: '#bbb', fontSize: 14 }}>暂无缩略图</span>
                  )}
                </div>

                {/* 信息区 */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: TYPE_COLORS[tpl.type] || '#666',
                      color: '#fff',
                    }}>
                      {TYPE_LABELS[tpl.type] || tpl.type}
                    </span>
                    {tpl.isDefault && (
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#fff3e0', color: '#e65100' }}>默认</span>
                    )}
                    {!tpl.isActive && (
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f5f5f5', color: '#999' }}>已停用</span>
                    )}
                  </div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>{tpl.name}</h4>
                  {tpl.description && <p style={{ margin: 0, fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.description}</p>}
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#999' }}>
                    {tpl.orgId ? `组织 #${tpl.orgId}` : '平台级'} · {new Date(tpl.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* 操作栏 */}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 14px', display: 'flex', gap: 8 }}>
                  <button onClick={() => router.push(`/admin/certificate-templates/editor?id=${tpl.id}`)} style={{ flex: 1, padding: '4px 0', fontSize: 12, background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>编辑</button>
                  <button onClick={() => router.push(`/admin/certificate-templates/batch?id=${tpl.id}`)} style={{ flex: 1, padding: '4px 0', fontSize: 12, background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>批量</button>
                  <button onClick={() => handleDuplicate(tpl.id)} style={{ flex: 1, padding: '4px 0', fontSize: 12, background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>复制</button>
                  {!tpl.isDefault && tpl.isActive && (
                    <button onClick={() => handleSetDefault(tpl.id)} style={{ flex: 1, padding: '4px 0', fontSize: 12, background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>设为默认</button>
                  )}
                  {tpl.isActive && (
                    <button onClick={() => handleDelete(tpl.id)} style={{ padding: '4px 8px', fontSize: 12, background: 'none', border: '1px solid #ffcdd2', borderRadius: 4, cursor: 'pointer', color: '#d32f2f' }}>停用</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ 从模板创建弹窗 ═══ */}
        {showPresetModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 12, width: 860, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>从模板创建</h3>
                <span style={{ marginLeft: 10, fontSize: 12, color: '#999' }}>选择一个内置版式，快速开始设计</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowPresetModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <div style={{ padding: 20, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {/* 空白模板 */}
                  <div
                    onClick={handleCreate}
                    style={{ border: '2px dashed #d0d0d0', borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.15s', background: '#fafafa' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#e87d30')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#d0d0d0')}
                  >
                    <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#ccc' }}>＋</div>
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #eee' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>空白模板</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>从零开始自由设计</div>
                    </div>
                  </div>
                  {/* 内置预设 */}
                  {TEMPLATE_PRESETS.map(preset => (
                    <div
                      key={preset.key}
                      onClick={() => !creatingPreset && handleCreateFromPreset(preset)}
                      style={{ border: '1px solid #e0e0e0', borderRadius: 10, cursor: creatingPreset ? 'wait' : 'pointer', overflow: 'hidden', transition: 'box-shadow 0.15s, transform 0.15s', opacity: creatingPreset && creatingPreset !== preset.key ? 0.5 : 1, background: '#fff' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ height: 130, overflow: 'hidden', position: 'relative', background: '#eee', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                        <div style={{ transform: 'scale(0.21)', transformOrigin: 'top center', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: renderCanvasToHtml(preset.canvas, PRESET_PREVIEW_DATA) }} />
                        {creatingPreset === preset.key && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#e87d30' }}>创建中…</div>
                        )}
                      </div>
                      <div style={{ padding: '10px 14px', borderTop: `3px solid ${preset.accent}` }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{preset.name}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{preset.description}</div>
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
