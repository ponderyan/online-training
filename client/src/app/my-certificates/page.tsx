'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';

export default function MyCertificatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    if (u.id) {
      fetch(`/api/certificates/my?studentId=${u.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => {
        if (!r.ok) throw new Error('加载失败');
        return r.json();
      }).then(data => {
        setCertificates(Array.isArray(data) ? data : []);
      }).catch(e => setError(e.message || '加载证书列表失败')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

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

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="page-title">🏅 我的证书</h1>
          <p className="page-subtitle">{user?.displayName || '学员'} · 已获得 {certificates.length} 份证书</p>
        </div>

        {loading ? (
          <SkeletonCardGrid count={3} />
        ) : error ? (
          <div className="card"><ErrorCard message={error} onRetry={() => window.location.reload()} /></div>
        ) : certificates.length === 0 ? (
          <div className="card">
            <EmptyState icon="🏅" title="还没有获得证书" description="参加考试并通过后，证书会自动出现在这里">
              <button onClick={() => router.push('/exam')} className="btn btn-fox btn-sm">去看看考试</button>
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-4">
            {certificates.map((cert: any) => (
              <div key={cert.id} className="card p-5 flex items-center gap-5">
                {/* Certificate icon */}
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: cert.isRevoked ? 'var(--verm-glow)' : 'var(--fox-pale)' }}>
                  {cert.isRevoked ? '❌' : '🏅'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--ink-700)' }}>
                    {cert.courseName}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--ink-400)' }}>
                    <span>编号：{cert.certificateNo}</span>
                    <span>发证：{new Date(cert.issueDate).toLocaleDateString('zh-CN')}</span>
                    {cert.isRevoked && (
                      <span style={{ color: 'var(--verm)' }}>已撤销</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {!cert.isRevoked && (
                    <button onClick={() => downloadPdf(cert.id)}
                      className="btn btn-fox btn-sm">📥 下载PDF</button>
                  )}
                  <button onClick={() => {
                    window.open(`/verify-certificate?no=${cert.certificateNo}&code=${cert.verificationCode}`, '_blank');
                  }} className="btn btn-ghost btn-sm">验证</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
