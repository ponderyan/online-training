'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import Loading from '@/components/Loading';
import { SkeletonTable } from '@/components/Skeleton';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import { useToast } from '@/components/Toast';
import { Pagination } from '@/components/ui/pagination';
import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/table';
import { Award, Eye, FileDown } from 'lucide-react';
import CertificatePreviewModal, { PreviewTarget } from '@/components/CertificatePreviewModal';
import { useDebounce } from '@/hooks/use-debounce';

const STATUS_NAMES: Record<string, string> = {
  ACTIVE: '有效', PENDING: '待审批', APPROVED: '有效',
  REJECTED: '已拒绝', REVOKED: '已撤销',
};
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: 'var(--cyan-glow)', color: 'var(--cyan)' },
  APPROVED: { bg: 'var(--cyan-glow)', color: 'var(--cyan)' },
  PENDING: { bg: 'var(--fox-pale)', color: 'var(--fox-dark)' },
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
  const debouncedKeyword = useDebounce(keyword);
  const [filterStatus, setFilterStatus] = useState('');
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null);

  const openPreview = (cert: any) => {
    setPreview({
      type: 'completion',
      pdfUrl: `/api/certificates/${cert.id}/pdf`,
      title: cert.courseName,
      completion: {
        studentName: cert.studentName,
        courseName: cert.courseName,
        certificateNo: cert.certificateNo,
        issueDate: cert.issueDate,
        verificationCode: cert.verificationCode || '',
      },
    });
  };

  const load = async (p: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (debouncedKeyword) params.set('keyword', debouncedKeyword);
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
  }, [debouncedKeyword, filterStatus]);

  const handleRevoke = async (reason: string) => {
    if (!revokeTarget) return;
    try {
      const res = await fetch(`/api/certificates/${revokeTarget}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('操作失败');
      toast.success('证书已撤销');
      setRevokeTarget(null);
      load();
    } catch (e: any) {
      toast.error('操作失败：' + e.message);
      setRevokeTarget(null);
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
          <h1 className="page-title flex items-center gap-2"><Award size={22} className="text-[var(--fox)]" /> 证书管理</h1>
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
          placeholder="搜索学员姓名/证书编号…" className="input" style={{ maxWidth: 320 }} />
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
          <EmptyState icon="" title="暂无证书" description="发布成绩后，可在此发证并下载 PDF" />
        </div>
      ) : (
        <Table>
          <THead>
            <TH>证书编号</TH>
            <TH>学员</TH>
            <TH>课程</TH>
            <TH>培训班</TH>
            <TH>发证日期</TH>
            <TH>防伪码</TH>
            <TH>状态</TH>
            <TH style={{ width: 120 }}>操作</TH>
          </THead>
          <TBody>
            {certificates.map((cert: any) => (
              <TR key={cert.id}>
                <TD className="font-mono text-xs font-medium text-[var(--ink-600)]">
                  {cert.certificateNo}
                </TD>
                <TD>
                  <span className="font-medium text-sm text-[var(--ink-600)]">
                    {cert.studentName}
                  </span>
                </TD>
                <TD className="text-xs max-w-[200px] truncate text-[var(--ink-400)]">
                  {cert.courseName}
                </TD>
                <TD className="text-xs text-[var(--ink-400)]">
                  {cert.program?.name || '—'}
                </TD>
                <TD className="text-xs text-[var(--ink-300)]">
                  {new Date(cert.issueDate).toLocaleDateString('zh-CN')}
                </TD>
                <TD className="font-mono text-xs text-[var(--ink-300)]">
                  {cert.verificationCode ? cert.verificationCode.slice(0, 8) + '…' : '—'}
                </TD>
                <TD>{renderStatus(cert)}</TD>
                <TD>
                  <div className="flex gap-1">
                    <button onClick={() => openPreview(cert)}
                      className="btn btn-ghost btn-xs"><Eye size={12} className="inline mr-0.5" />预览</button>
                    <button onClick={() => downloadPdf(cert.id)}
                      className="btn btn-ghost btn-xs"><FileDown size={12} className="inline mr-0.5" />PDF</button>
                    {!cert.isRevoked && cert.approvalStatus !== 'REJECTED' && (
                      <button onClick={() => setRevokeTarget(cert.id)}
                        className="btn btn-ghost btn-xs text-[var(--verm)]">撤销</button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} onChange={(p) => load(p)} />

      <CertificatePreviewModal target={preview} onClose={() => setPreview(null)} />
      {/* 吊销确认弹窗 */}
      <ReasonConfirmModal
        open={revokeTarget !== null}
        title="🛑 撤销证书"
        message="此操作将作废该证书，撤销后该证书的验证链接将显示为已撤销。确定继续？"
        required
        presetReasons={['证书发放错误', '学员信息有误', '考试资格不符', '管理员申请撤销']}
        confirmText="确认撤销"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
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
