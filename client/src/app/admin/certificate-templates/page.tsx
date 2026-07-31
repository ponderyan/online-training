'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';

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
          <button onClick={handleCreate} className="btn btn-sm" style={{ background: '#e87d30', color: '#fff', padding: '8px 16px', borderRadius: 6 }}>
            + 新建模板
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
      </div>
    </AppLayout>
  );
}
