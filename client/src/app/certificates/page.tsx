'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import Loading from '@/components/Loading';
import { SkeletonTable } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

const STATUS_NAMES: Record<string, string> = {
  ACTIVE: '有效', PENDING: '待审批', APPROVED: '有效',
  REJECTED: '已拒绝', REVOKED: '已撤销',
};
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: 'var(--cyan-glow)', color: 'var(--cyan)' },
  APPROVED: { bg: 'var(--cyan-glow)', color: 'var(--cyan)' },
  PENDING: { bg: '#fff3e0', color: '#e65100' },
  REJECTED: { bg: 'var(--verm-glow)', color: 'var(--verm)' },
  REVOKED: { bg: 'var(--verm-glow)', color: 'var(--verm)' },
};

function CertificatesContent() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const filterExamSessionId = searchParams.get('examSessionId');

  const [certificates, setCertificates] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async (p: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (keyword) params.set('keyword', keyword);
      if (filterStatus) params.set('status', filterStatus);
      if (filterExamSessionId) params.set('examSessionId', filterExamSessionId);
      const res = await fetch(`/api/certificates?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json());
      setCertificates(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e: any) {
      setError(e.message || '加载证书列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    const timer = setTimeout(() => { load(1); }, 400);
    return () => clearTimeout(timer);
  }, [keyword, filterStatus]);

  const handleRevoke = async (id: number) => {
    const reason = prompt('请输入撤销原因：');
    if (!reason) return;
    try {
      const res = await fetch(`/api/certificates/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('操作失败');
      toast.success('证书已撤销');
      load();
    } catch (e: any) {
      toast.error('操作失败：' + e.message);
    }
  };

  const downloadPdf = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/certificates/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('下载失败：' + e.message);
    }
  };

  const renderStatus = (cert: any) => {
    if (cert.isRevoked) return <span className="tag" style={STATUS_STYLES.REVOKED}>已撤销</span>;
    const key = cert.approvalStatus === 'APPROVED' ? 'ACTIVE' : cert.approvalStatus || 'ACTIVE';
    const style = STATUS_STYLES[key] || STATUS_STYLES.ACTIVE;
    return <span className="tag" style={style}>{STATUS_NAMES[key] || '有效'}</span>;
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🏅 证书管理</h1>
          <p className="page-subtitle">
            共 {total} 份证书
            {filterExamSessionId && ` · 筛选自考试场次 #${filterExamSessionId}`}
            {totalPages > 1 && <span className="ml-2 text-xs opacity-50">第 {page}/{totalPages} 页</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="🔍 搜索学员姓名/证书编号…" className="input" style={{ maxWidth: 320 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input select" style={{ maxWidth: 120 }}>
          <option value="">全部状态</option>
          <option value="ACTIVE">有效</option>
          <option value="PENDING">待审批</option>
          <option value="REJECTED">已拒绝</option>
          <option value="REVOKED">已撤销</option>
        </select>
      </div>

      {loading ? (
        <div className="card"><div className="card-body"><SkeletonTable rows={6} cols={8} /></div></div>
      ) : error ? (
        <div className="card"><ErrorCard message={error} onRetry={() => load()} /></div>
      ) : certificates.length === 0 ? (
        <div className="card">
          <EmptyState icon="🏅" title="暂无证书" description="发布成绩后，可在此发证并下载 PDF" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="list-table">
              <thead>
                <tr>
                  <th>证书编号</th>
                  <th>学员</th>
                  <th>课程</th>
                  <th>培训班</th>
                  <th>发证日期</th>
                  <th>防伪码</th>
                  <th>状态</th>
                  <th style={{ width: 120 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert: any) => (
                  <tr key={cert.id}>
                    <td className="font-mono text-xs font-medium" style={{ color: 'var(--ink-600)' }}>
                      {cert.certificateNo}
                    </td>
                    <td>
                      <span className="font-medium text-sm" style={{ color: 'var(--ink-600)' }}>
                        {cert.studentName}
                      </span>
                    </td>
                    <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ink-400)' }}>
                      {cert.courseName}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-400)' }}>
                      {cert.program?.name || '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-300)' }}>
                      {new Date(cert.issueDate).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--ink-300)' }}>
                      {cert.verificationCode ? cert.verificationCode.slice(0, 8) + '…' : '—'}
                    </td>
                    <td>{renderStatus(cert)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => downloadPdf(cert.id)}
                          className="btn btn-ghost btn-xs">📄 PDF</button>
                        {!cert.isRevoked && cert.approvalStatus !== 'REJECTED' && (
                          <button onClick={() => handleRevoke(cert.id)}
                            className="btn btn-ghost btn-xs"
                            style={{ color: 'var(--verm)' }}>撤销</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => load(page - 1)} disabled={page <= 1}
            className="btn btn-ghost btn-xs" style={{ opacity: page <= 1 ? 0.3 : 1 }}>‹ 上一页</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="mx-1 text-xs" style={{ color: 'var(--ink-300)' }}>…</span>}
                <button onClick={() => load(p)}
                  className={`btn btn-xs ${p === page ? 'btn-fox' : 'btn-ghost'}`}>{p}</button>
              </span>
            ))}
          <button onClick={() => load(page + 1)} disabled={page >= totalPages}
            className="btn btn-ghost btn-xs" style={{ opacity: page >= totalPages ? 0.3 : 1 }}>下一页 ›</button>
        </div>
      )}
    </AppLayout>
  );
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <Loading />
      </AppLayout>
    }>
      <CertificatesContent />
    </Suspense>
  );
}
