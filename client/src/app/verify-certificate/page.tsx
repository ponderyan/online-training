'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams();
  const [certNo, setCertNo] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (no?: string, c?: string) => {
    const finalNo = no || certNo;
    const finalCode = c || code;
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

  return (
    <div className="min-h-screen" style={{ background: '#f5f0eb', fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif' }}>
      <div className="max-w-lg mx-auto pt-16 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-2">🦊</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#3a3028' }}>FoxLearn · 证书验证</h1>
          <p style={{ fontSize: 13, color: '#8a8078', marginTop: 4 }}>输入证书信息验证真伪</p>
        </div>

        {/* Search form */}
        <div className="rounded-xl p-6 mb-6" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="space-y-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#8a8078', fontWeight: 500 }}>证书编号</label>
              <input value={certNo} onChange={e => setCertNo(e.target.value)}
                placeholder="例如：FX-20260620-0001"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid #e0d8d0', outline: 'none', background: '#faf8f6' }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#8a8078', fontWeight: 500 }}>防伪码</label>
              <input value={code} onChange={e => setCode(e.target.value)}
                placeholder="输入防伪码（可无视大小写）"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm"
                style={{ border: '1px solid #e0d8d0', outline: 'none', background: '#faf8f6' }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()} />
            </div>
            <button onClick={() => handleVerify()} disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white border-none cursor-pointer transition-all"
              style={{ background: loading ? '#c8a888' : '#e87a30' }}>
              {loading ? '查询中…' : '🔍 查询验证'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: '#fff0ee', color: '#c62828' }}>
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-xl p-6 mb-6" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {result.valid ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">✅</span>
                  <span className="text-sm font-semibold" style={{ color: '#2e7d32' }}>验证通过</span>
                  <span className="text-xs ml-auto px-2 py-0.5 rounded-full" style={{ background: '#e8f5e9', color: '#2e7d32' }}>有效证书</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span style={{ color: '#8a8078' }}>持证人</span><span className="font-medium" style={{ color: '#3a3028' }}>{result.certificate?.studentName || '—'}</span></div>
                  <div className="flex justify-between"><span style={{ color: '#8a8078' }}>课程</span><span className="font-medium" style={{ color: '#3a3028' }}>{result.certificate?.courseName || '—'}</span></div>
                  <div className="flex justify-between"><span style={{ color: '#8a8078' }}>证书编号</span><span className="font-mono text-xs" style={{ color: '#5a5048' }}>{result.certificate?.certificateNo || '—'}</span></div>
                  <div className="flex justify-between"><span style={{ color: '#8a8078' }}>发证日期</span><span style={{ color: '#5a5048' }}>{result.certificate?.issueDate ? new Date(result.certificate.issueDate).toLocaleDateString('zh-CN') : '—'}</span></div>
                  <div className="flex justify-between"><span style={{ color: '#8a8078' }}>证书状态</span><span className="tag" style={{ background: '#e8f5e9', color: '#2e7d32' }}>有效</span></div>
                </div>
                {result.certificate?.verificationUrl && (
                  <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: '#f0ebe5' }}>
                    <span className="text-xs" style={{ color: '#b0a898' }}>验证来源：{result.certificate.verificationUrl}</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">❌</span>
                  <span className="text-sm font-semibold" style={{ color: '#c62828' }}>验证失败</span>
                </div>
                <p className="text-sm" style={{ color: '#5a5048' }}>
                  {result.certificate?.isRevoked
                    ? '该证书已被撤销'
                    : '未找到匹配的证书，请确认输入正确'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-12">
          <a href="/" className="text-xs" style={{ color: '#e87a30', textDecoration: 'none' }}>← 返回首页</a>
          <div className="mt-3 text-xs" style={{ color: '#b0a898' }}>© {new Date().getFullYear()} FoxLearn · 狐学</div>
        </div>
      </div>
    </div>
  );
}
