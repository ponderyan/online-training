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
    <div className="min-h-dvh-fb flex flex-col" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f5ede4 100%)', fontFamily: 'var(--font-sans, "PingFang SC","Microsoft YaHei",sans-serif)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(196,188,176,0.3)]" style={{  background: 'color-mix(in srgb, var(--paper-bright) 75%, transparent)' }}>
        <FoxLogo size={32} />
        <div className="text-[var(--ink-700)] font-serif font-bold text-lg tracking-wider">
          {settings?.siteName || 'FoxLearn'}
        </div>
        <span className="text-[var(--ink-300)] text-xs ml-auto">
          证书验证平台
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-12">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🏅</div>
            <h1 className="text-[var(--ink-700)] text-2xl font-serif font-bold">结业证书验证</h1>
            <p className="text-[var(--ink-300)] text-sm mt-1">
              输入证书编号和防伪码查验真伪
            </p>
          </div>

          {/* Search form */}
          <div className="card p-5 mb-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1.5 block text-[var(--ink-400)]" style={{  fontWeight: 500 }}>证书编号</label>
                <input value={certNo} onChange={e => setCertNo(e.target.value)}
                  placeholder="例如：FX-20260620-0001"
                  className="input w-full text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block text-[var(--ink-400)]" style={{  fontWeight: 500 }}>防伪码</label>
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
            <div className="card p-6 text-center bg-[var(--verm-glow)]" style={{ border: '2px solid var(--verm-glow)',  }}>
              <div className="text-4xl mb-2">❌</div>
              <p className="text-[var(--verm)] text-sm font-medium">验证失败</p>
              <p className="text-[var(--verm)] text-xs mt-1">{error}</p>
            </div>
          )}

          {/* Valid result */}
          {isValid && !loading && cert && (
            <div className="card p-6 bg-[var(--cyan-glow)]" style={{ border: `2px solid var(--cyan-glow)`,  }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <span className="text-[var(--cyan)] text-sm font-semibold">验证通过 · 真实有效</span>
                <span className="tag ml-auto bg-[rgba(0,137,123,0.15)] text-[var(--cyan)]" >有效证书</span>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-400)]">持证人</span>
                  <span className="text-[var(--ink-700)] font-medium">{cert.studentName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-400)]">课程</span>
                  <span className="font-medium text-right text-[var(--ink-700)]" style={{  maxWidth: 280 }}>{cert.courseName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-400)]">证书编号</span>
                  <span className="text-[var(--ink-600)] font-mono text-xs">{cert.certificateNo || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-400)]">发证日期</span>
                  <span className="text-[var(--ink-600)]">{cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('zh-CN') : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-400)]">证书状态</span>
                  <span className="tag bg-[rgba(0,137,123,0.15)] text-[var(--cyan)]" >有效</span>
                </div>
              </div>
              {cert.verificationUrl && (
                <div className="border-[var(--paper-dark)] mt-4 pt-3 border-t text-center">
                  <span className="text-[var(--ink-300)] text-xs">验证来源：{cert.verificationUrl}</span>
                </div>
              )}
            </div>
          )}

          {/* Revoked / invalid result */}
          {result && !isValid && !loading && (
            <div className="card p-6 text-center bg-[var(--verm-glow)]" style={{ border: '2px solid var(--verm-glow)',  }}>
              <div className="text-4xl mb-2">{isRevoked ? '⛔' : '❌'}</div>
              <p className="text-[var(--verm)] text-sm font-medium">
                {isRevoked ? '该证书已被撤销' : '验证失败'}
              </p>
              <p className="text-[var(--ink-400)] text-xs mt-1">
                {isRevoked
                  ? `撤销时间：${cert.revokedAt ? new Date(cert.revokedAt).toLocaleDateString('zh-CN') : '—'}`
                  : '未找到匹配的证书，请确认编号和防伪码输入正确'}
              </p>
              {isRevoked && cert.revokeReason && (
                <p className="text-[var(--ink-400)] text-xs mt-1">原因：{cert.revokeReason}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 pb-12">
            <a href="/" className="text-xs text-[var(--fox)]" style={{  textDecoration: 'none' }}>← 返回首页</a>
            <div className="text-[var(--ink-300)] mt-3 text-xs">© {new Date().getFullYear()} FoxLearn · 狐学</div>
          </div>
        </div>
      </main>
    </div>
  );
}
