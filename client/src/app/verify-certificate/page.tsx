'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams();
  const settings = useSiteSettings();
  const [certNo, setCertNo] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (no?: string, c?: string) => {
    const finalNo = (no || certNo).trim();
    const finalCode = (c || code).trim();
    if (!finalNo || !finalCode) { setError('请输入证书编号和防伪码'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/certificates/verify?no=${encodeURIComponent(finalNo)}&code=${encodeURIComponent(finalCode)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '查询失败');
      setResult(data);
    } catch (e: any) {
      setError(e.message || '查询失败，请稍后重试');
    }
    setLoading(false);
  };

  // 扫码/URL参数自动触发
  useEffect(() => {
    const no = searchParams.get('no');
    const c = searchParams.get('code');
    if (no && c) {
      setCertNo(no);
      setCode(c);
      handleVerify(no, c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cert = result?.certificate;
  const isValid = result?.valid === true;
  const isRevoked = cert?.isRevoked === true;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f5ede4 100%)', fontFamily: 'var(--font-sans, "PingFang SC","Microsoft YaHei",sans-serif)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(196,188,176,0.3)', background: 'rgba(255,255,255,0.7)' }}>
        <FoxLogo size={32} />
        <div className="font-serif font-bold text-lg tracking-wider" style={{ color: 'var(--ink-700)' }}>
          {settings?.siteName || 'FoxLearn'}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--ink-300)' }}>
          证书验证平台
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🏅</div>
            <h1 className="text-2xl font-serif font-bold" style={{ color: 'var(--ink-700)' }}>结业证书验证</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-300)' }}>
              输入证书编号和防伪码查验真伪
            </p>
          </div>

          {/* Search form */}
          <div className="card p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--ink-400)', fontWeight: 500 }}>证书编号</label>
                <input value={certNo} onChange={e => setCertNo(e.target.value)}
                  placeholder="例如：FX-20260620-0001"
                  className="input w-full text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--ink-400)', fontWeight: 500 }}>防伪码</label>
                <input value={code} onChange={e => setCode(e.target.value)}
                  placeholder="输入防伪码（忽略大小写）"
                  className="input w-full text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()} />
              </div>
              <button onClick={() => handleVerify()} disabled={loading}
                className="btn btn-fox w-full py-2.5 text-sm">
                {loading ? '查询中…' : '🔍 查询验证'}
              </button>
            </div>
          </div>

          {/* Error / loading */}
          {error && !loading && (
            <div className="card p-6 text-center" style={{ border: '2px solid var(--verm-glow)', background: 'var(--verm-glow)' }}>
              <div className="text-4xl mb-2">❌</div>
              <p className="text-sm font-medium" style={{ color: 'var(--verm)' }}>验证失败</p>
              <p className="text-xs mt-1" style={{ color: 'var(--verm)' }}>{error}</p>
            </div>
          )}

          {/* Valid result */}
          {isValid && !loading && cert && (
            <div className="card p-6" style={{ border: `2px solid var(--cyan-glow)`, background: 'var(--cyan-glow)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--cyan)' }}>验证通过 · 真实有效</span>
                <span className="tag ml-auto" style={{ background: 'rgba(0,137,123,0.15)', color: 'var(--cyan)' }}>有效证书</span>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>持证人</span>
                  <span className="font-medium" style={{ color: 'var(--ink-700)' }}>{cert.studentName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>课程</span>
                  <span className="font-medium text-right" style={{ color: 'var(--ink-700)', maxWidth: 280 }}>{cert.courseName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>证书编号</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--ink-600)' }}>{cert.certificateNo || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>发证日期</span>
                  <span style={{ color: 'var(--ink-600)' }}>{cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('zh-CN') : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-400)' }}>证书状态</span>
                  <span className="tag" style={{ background: 'rgba(0,137,123,0.15)', color: 'var(--cyan)' }}>有效</span>
                </div>
              </div>
              {cert.verificationUrl && (
                <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: 'var(--paper-dark)' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-300)' }}>验证来源：{cert.verificationUrl}</span>
                </div>
              )}
            </div>
          )}

          {/* Revoked / invalid result */}
          {result && !isValid && !loading && (
            <div className="card p-6 text-center" style={{ border: '2px solid var(--verm-glow)', background: 'var(--verm-glow)' }}>
              <div className="text-4xl mb-2">{isRevoked ? '⛔' : '❌'}</div>
              <p className="text-sm font-medium" style={{ color: 'var(--verm)' }}>
                {isRevoked ? '该证书已被撤销' : '验证失败'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                {isRevoked
                  ? `撤销时间：${cert.revokedAt ? new Date(cert.revokedAt).toLocaleDateString('zh-CN') : '—'}`
                  : '未找到匹配的证书，请确认编号和防伪码输入正确'}
              </p>
              {isRevoked && cert.revokeReason && (
                <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>原因：{cert.revokeReason}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 pb-12">
            <a href="/" className="text-xs" style={{ color: 'var(--fox)', textDecoration: 'none' }}>← 返回首页</a>
            <div className="mt-3 text-xs" style={{ color: 'var(--ink-300)' }}>© {new Date().getFullYear()} FoxLearn · 狐学</div>
          </div>
        </div>
      </main>
    </div>
  );
}
