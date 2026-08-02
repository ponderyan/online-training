'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

export default function VerifyHoursPage() {
  const searchParams = useSearchParams();
  const settings = useSiteSettings();
  const [certNo, setCertNo] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const no = searchParams.get('no');
    if (no) {
      setCertNo(no);
      handleVerify(no);
    }
  }, []);

  const handleVerify = async (no?: string) => {
    const value = no || certNo;
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/learning-hour-certificates/verify?no=${encodeURIComponent(value.trim())}`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || '验证失败');
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || '查询失败');
    }
    setLoading(false);
  };

  const cert = result?.certificate || result;
  const isValid = result?.valid === true && cert?.approvalStatus !== 'REJECTED' && cert?.approvalStatus !== 'REVOKED';
  const isRevoked = cert?.isRevoked === true || cert?.approvalStatus === 'REVOKED';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f5ede4 100%)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(196,188,176,0.3)', background: 'rgba(255,255,255,0.7)' }}>
        <FoxLogo size={32} />
        <div className="font-serif font-bold text-lg tracking-wider" style={{ color: 'var(--ink-600)' }}>
          {settings?.siteName || 'FoxLearn'}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--ink-300)' }}>
          学时证明验证平台
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">📜</div>
            <h1 className="text-2xl font-serif font-bold" style={{ color: 'var(--ink-600)' }}>学时证明验证</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-300)' }}>
              输入证明编号查询真伪
            </p>
          </div>

          {/* Input area */}
          <div className="card p-5 mb-6">
            <div className="flex gap-2">
              <input
                value={certNo}
                onChange={e => setCertNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="请输入学时证明编号…"
                className="input flex-1 text-sm"
              />
              <button onClick={() => handleVerify()} disabled={loading || !certNo.trim()}
                className="btn btn-fox btn-sm px-5">
                {loading ? '查询中…' : '查询'}
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-8" style={{ color: 'var(--ink-300)' }}>
              <span className="text-2xl">🦊</span>
              <p className="text-sm mt-2">正在查询…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="card p-6 text-center"
              style={{ border: '2px solid #ef9a9a', background: 'var(--error-pale)' }}>
              <div className="text-4xl mb-2">❌</div>
              <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>验证失败</p>
              <p className="text-xs mt-1" style={{ color: 'var(--error-light)' }}>{error}</p>
            </div>
          )}

          {/* Valid result */}
          {isValid && !loading && (
            <div className="card p-6"
              style={{ border: '2px solid #a5d6a7', background: 'var(--success-pale)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--sage)' }}>验证通过 - 真实有效</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-xs" style={{ color: 'var(--sage)' }}>学员姓名</span>
                    <span className="font-medium">{cert.studentName}</span>
                  </div>
                  {cert.idCardMasked && (
                    <div>
                      <span className="block text-xs" style={{ color: 'var(--sage)' }}>证件号</span>
                      <span className="text-sm" style={{ color: 'var(--ink-400)' }}>
                        {cert.idCardMasked}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t" style={{ borderColor: 'var(--sage-light)' }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-xs" style={{ color: 'var(--sage)' }}>培训项目</span>
                      <span>{cert.programName}</span>
                    </div>
                    <div>
                      <span className="block text-xs" style={{ color: 'var(--sage)' }}>总学时</span>
                      <span className="font-bold" style={{ color: 'var(--sage)' }}>{cert.totalHours} 小时</span>
                    </div>
                  </div>
                </div>

                {cert.hoursDetail?.length > 0 && (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--sage-light)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--sage)' }}>学时明细</span>
                    {cert.hoursDetail.map((d: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span>{d.typeName || d.source}</span>
                        <span>{d.hours} 小时</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t" style={{ borderColor: 'var(--sage-light)' }}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block" style={{ color: 'var(--sage)' }}>证明编号</span>
                      <span className="font-mono">{cert.certificateNo}</span>
                    </div>
                    <div>
                      <span className="block" style={{ color: 'var(--sage)' }}>颁发时间</span>
                      <span>{cert.approvedAt ? new Date(cert.approvedAt).toLocaleDateString('zh-CN') : '—'}</span>
                    </div>
                  </div>
                </div>

                {cert.contentHash && (
                  <div className="pt-2 border-t flex items-center gap-1" style={{ borderColor: 'var(--sage-light)' }}>
                    <span className="text-xs" style={{ color: 'var(--sage)' }}>🛡️ 内容指纹：</span>
                    <span className="text-[10px] font-mono" style={{ color: '#689f38' }}>
                      {cert.contentHash.slice(0, 16)}...
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--sage)' }}>
                      ✅ 印章内容未被篡改
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revoked / Invalid result */}
          {result && !isValid && !loading && (
            <div className="card p-6 text-center"
              style={{ border: '2px solid #ef9a9a', background: 'var(--error-pale)' }}>
              <div className="text-4xl mb-2">❌</div>
              <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                {isRevoked ? '此证明已被撤销' : '证明无效'}
              </p>
              {cert.certificateNo && (
                <p className="text-xs mt-2 font-mono" style={{ color: 'var(--error-light)' }}>
                  编号：{cert.certificateNo}
                </p>
              )}
              {cert.revokeReason && (
                <p className="text-xs mt-2" style={{ color: 'var(--error-light)' }}>
                  撤销原因：{cert.revokeReason}
                </p>
              )}
              {cert.revokedAt && (
                <p className="text-xs mt-1" style={{ color: 'var(--error-light)' }}>
                  撤销时间：{new Date(cert.revokedAt).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
          🦊 FoxLearn 狐学 · 学时证明在线验证平台
        </p>
      </footer>
    </div>
  );
}
