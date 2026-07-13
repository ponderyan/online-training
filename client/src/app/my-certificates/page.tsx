'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import EmptyState from '@/components/EmptyState';
import ErrorCard from '@/components/ErrorCard';
import { SkeletonCardGrid } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import CertificatePreviewModal, { PreviewTarget } from '@/components/CertificatePreviewModal';

/** 统一卡片项：结业证书 / 学时证明 合并展示 */
interface CertCard {
  key: string;
  kind: 'completion' | 'hours';
  id: number;
  title: string;          // 课程名 / 培训班名
  certificateNo: string;
  issueDate: string;      // ISO
  verificationCode?: string;
  totalHours?: number;
  status: 'active' | 'revoked' | 'pending' | 'rejected';
  statusText: string;
}

const HOURS_STATUS: Record<string, { text: string; status: CertCard['status'] }> = {
  AUTO_APPROVED: { text: '有效', status: 'active' },
  APPROVED: { text: '有效', status: 'active' },
  PENDING: { text: '待审核', status: 'pending' },
  REJECTED: { text: '已驳回', status: 'rejected' },
  REVOKED: { text: '已撤销', status: 'revoked' },
};

export default function MyCertificatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [cards, setCards] = useState<CertCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  // 学时证明完整记录（findMy 已返回全字段，预览直接复用，避免调仅管理端的 get/:id）
  const [hoursRecords, setHoursRecords] = useState<Record<number, any>>({});

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    (async () => {
      try {
        const [completions, hours] = await Promise.all([
          api.certificates.my().catch(() => []),
          api.learningHourCertificates.my().catch(() => []),
        ]);
        const list: CertCard[] = [];
        (Array.isArray(completions) ? completions : []).forEach((c: any) => {
          list.push({
            key: `c-${c.id}`,
            kind: 'completion',
            id: c.id,
            title: c.courseName,
            certificateNo: c.certificateNo,
            issueDate: c.issueDate,
            verificationCode: c.verificationCode,
            status: c.isRevoked ? 'revoked' : 'active',
            statusText: c.isRevoked ? '已撤销' : '有效',
          });
        });
        (Array.isArray(hours) ? hours : []).forEach((h: any) => {
          const st = HOURS_STATUS[h.approvalStatus] || { text: h.approvalStatus, status: 'active' };
          list.push({
            key: `h-${h.id}`,
            kind: 'hours',
            id: h.id,
            title: h.programName || '学时证明',
            certificateNo: h.certificateNo,
            issueDate: h.appliedAt || h.createdAt,
            totalHours: h.totalHours,
            status: st.status,
            statusText: st.text,
          });
        });
        setHoursRecords(Object.fromEntries((hours as any[]).map((h) => [h.id, h])));
        // 结业证书优先，其次学时证明；同类按日期倒序
        list.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'completion' ? -1 : 1;
          return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
        });
        setCards(list);
      } catch (e: any) {
        setError(e.message || '加载证书列表失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openPreview = (card: CertCard) => {
    if (card.kind === 'completion') {
      setPreview({
        type: 'completion',
        pdfUrl: `/api/certificates/${card.id}/pdf`,
        title: card.title,
        completion: {
          studentName: user?.displayName || '—',
          courseName: card.title,
          certificateNo: card.certificateNo,
          issueDate: card.issueDate,
          verificationCode: card.verificationCode || '',
        },
      });
    } else {
      // 学时证明：findMy 已返回完整记录，直接复用（get/:id 是管理端权限，学员无权调）
      const h = hoursRecords[card.id];
      if (!h) {
        toast.error('证明详情加载失败，请刷新重试');
        return;
      }
      setPreview({
        type: 'hours',
        pdfUrl: `/api/learning-hour-certificates/${card.id}/pdf`,
        title: card.title,
        hours: {
          studentName: h.studentName || user?.displayName || '—',
          idCardMasked: h.idCard,
          programName: h.programName,
          orgName: h.orgName,
          totalHours: h.totalHours,
          hoursDetail: h.hoursDetail,
          startDate: h.startDate,
          endDate: h.endDate,
          certificateNo: h.certificateNo,
          issueDate: h.appliedAt || h.createdAt,
          sealHash: h.sealHash,
        },
      });
    }
  };

  const downloadPdf = async (card: CertCard) => {
    try {
      const token = localStorage.getItem('token');
      const url = card.kind === 'completion'
        ? `/api/certificates/${card.id}/pdf`
        : `/api/learning-hour-certificates/${card.id}/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `${card.kind}-${card.certificateNo}.pdf`;
      a.click();
      URL.revokeObjectURL(u);
    } catch (e: any) {
      toast.error('下载失败：' + e.message);
    }
  };

  const statusBadge = (card: CertCard) => {
    const palette: Record<string, { bg: string; color: string }> = {
      active: { bg: 'var(--cyan-glow)', color: 'var(--cyan)' },
      revoked: { bg: 'var(--verm-glow)', color: 'var(--verm)' },
      pending: { bg: '#fff3e0', color: '#e65100' },
      rejected: { bg: 'var(--verm-glow)', color: 'var(--verm)' },
    };
    const s = palette[card.status] || palette.active;
    return (
      <span className="tag" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
        {card.statusText}
      </span>
    );
  };

  const activeCount = cards.filter(c => c.status === 'active').length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="page-title">🏅 我的证书</h1>
          <p className="page-subtitle">{user?.displayName || '学员'} · 共 {cards.length} 份（有效 {activeCount}）</p>
        </div>

        {/* 类型图例 */}
        <div className="flex gap-2 mb-5 text-xs" style={{ color: 'var(--ink-400)' }}>
          <span className="flex items-center gap-1.5"><span>🎓</span> 结业证书（考试通过）</span>
          <span className="mx-2" style={{ color: 'var(--ink-200)' }}>·</span>
          <span className="flex items-center gap-1.5"><span>📜</span> 学时证明（培训学时）</span>
        </div>

        {loading ? (
          <SkeletonCardGrid count={3} />
        ) : error ? (
          <div className="card"><ErrorCard message={error} onRetry={() => window.location.reload()} /></div>
        ) : cards.length === 0 ? (
          <div className="card">
            <EmptyState icon="🏅" title="还没有获得证书" description="参加考试并通过后，结业证书会自动出现在这里；学时证明可在培训班页申请">
              <button onClick={() => router.push('/exam')} className="btn btn-fox btn-sm">去看看考试</button>
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <div key={card.key} className="card p-5 flex flex-col gap-3"
                style={{ borderRadius: 12, transition: 'box-shadow 0.2s' }}>
                {/* 顶部：图标 + 类型 + 状态角标 */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: card.kind === 'completion' ? 'var(--fox-pale)' : 'var(--cyan-glow)',
                    }}>
                    {card.kind === 'completion' ? '🎓' : '📜'}
                  </div>
                  {statusBadge(card)}
                </div>

                {/* 标题 */}
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-300)' }}>
                    {card.kind === 'completion' ? '结业证书' : '学时证明'}
                  </div>
                  <h3 className="font-bold text-sm truncate" style={{ color: 'var(--ink-700)' }}>
                    {card.title}
                  </h3>
                </div>

                {/* 元信息 */}
                <div className="text-xs space-y-1" style={{ color: 'var(--ink-400)' }}>
                  <div className="flex items-center gap-1.5">
                    <span>编号：</span>
                    <span className="font-mono" style={{ color: 'var(--ink-600)' }}>{card.certificateNo}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>{card.kind === 'completion' ? '颁发' : '申请'}：</span>
                    <span>{new Date(card.issueDate).toLocaleDateString('zh-CN')}</span>
                  </div>
                  {card.kind === 'hours' && card.totalHours != null && (
                    <div className="flex items-center gap-1.5">
                      <span>学时：</span>
                      <span className="font-medium" style={{ color: 'var(--fox)' }}>{card.totalHours} 小时</span>
                    </div>
                  )}
                </div>

                {/* 操作 */}
                <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                  {card.status === 'active' && (
                    <>
                      <button onClick={() => openPreview(card)} className="btn btn-fox btn-sm flex-1">
                        👁 查看证书
                      </button>
                      <button onClick={() => downloadPdf(card)} className="btn btn-outline btn-sm">
                        📥 下载
                      </button>
                    </>
                  )}
                  {card.kind === 'completion' && (
                    <button
                      onClick={() => window.open(`/verify-certificate?no=${card.certificateNo}&code=${card.verificationCode}`, '_blank')}
                      className="btn btn-ghost btn-sm">
                      验证
                    </button>
                  )}
                  {card.status !== 'active' && (
                    <span className="text-xs self-center" style={{ color: 'var(--ink-300)' }}>
                      {card.status === 'pending' ? '审核中，通过后可查看/下载' : '此证书不可用'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CertificatePreviewModal target={preview} onClose={() => setPreview(null)} />
    </AppLayout>
  );
}
