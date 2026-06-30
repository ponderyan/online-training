'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

export default function LoginPage() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();
      setCaptchaId(data.id);
      setCaptchaSvg(data.svg);
    } catch {
      // 验证码服务不可用时静默失败
    }
  }, []);

  useEffect(() => { fetchCaptcha(); }, [fetchCaptcha]);

  async function handleLogin() {
    if (!username || !password) { setError('请输入用户名和密码'); return; }
    if (!captchaAnswer) { setError('请输入验证码'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, captchaId, captchaAnswer }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        fetchCaptcha();
        setCaptchaAnswer('');
        return;
      }
      if (!res.ok) throw new Error('用户名或密码错误');
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.permissions) {
        localStorage.setItem('userPermissions', JSON.stringify({
          permissions: data.user.permissions,
          roles: data.user.roles || [],
        }));
      }
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.message);
      fetchCaptcha();
      setCaptchaAnswer('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ═══ 左侧品牌展示区 ═══ */}
      <div className="hidden lg:flex w-[44%] flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1a1712 0%, #231f1a 40%, #2c261e 70%, #1a1712 100%)',
        }}>
        {/* 装饰性几何元素 — 抽象狐狸造型 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <svg viewBox="0 0 800 900" className="w-full h-full">
            <path d="M300,400 L200,150 L480,300Z" fill="#e87a30" />
            <path d="M500,400 L600,150 L320,300Z" fill="#e87a30" />
            <ellipse cx="400" cy="460" rx="260" ry="200" fill="#e87a30" />
            <ellipse cx="400" cy="520" rx="180" ry="130" fill="#fce6d3" />
            <ellipse cx="360" cy="460" rx="30" ry="36" fill="#1a1712" />
            <ellipse cx="440" cy="460" rx="30" ry="36" fill="#1a1712" />
            <ellipse cx="400" cy="510" rx="28" ry="18" fill="#c9601e" />
            <path d="M370,540 Q400,570 430,540" stroke="#c9601e" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        {/* 装饰性圆点图案 */}
        <div className="absolute top-12 left-12 w-32 h-32 rounded-full border border-[#e87a30]/10" />
        <div className="absolute top-24 left-24 w-20 h-20 rounded-full border border-[#e87a30]/8" />
        <div className="absolute bottom-24 right-16 w-40 h-40 rounded-full border border-[#e87a30]/8" />
        <div className="absolute bottom-36 right-28 w-24 h-24 rounded-full border border-[#e87a30]/6" />

        {/* 品牌内容 */}
        <div className="relative z-10 text-center px-12">
          <div className="mb-6 flex justify-center">
            <FoxLogo size={72} />
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-wider text-white mb-3">
            狐学
          </h1>
          <p className="text-base tracking-[0.15em] font-light"
            style={{ color: '#f5a061' }}>
            智能在线培训考试平台
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, #e87a30)' }} />
            <span className="text-xs tracking-widest" style={{ color: '#736a5c' }}>跟着小狐狸</span>
            <span className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #e87a30, transparent)' }} />
          </div>
          <p className="text-xs mt-2" style={{ color: '#8b8174' }}>
            知识不迷路 🐾
          </p>
        </div>

        {/* 底部版本/备案 */}
        <div className="absolute bottom-8 text-xs tracking-wide" style={{ color: '#5a5348' }}>
          {settings?.icpBeian || '© 2026 FoxLearn'}
        </div>
      </div>

      {/* ═══ 右侧登录表单区 ═══ */}
      <div className="flex-1 flex items-center justify-center p-6"
        style={{
          background: 'linear-gradient(135deg, #f6f1e8 0%, #efe9dc 50%, #f0ece1 100%)',
        }}>
        <div className="w-full max-w-[420px]">

          {/* 移动端品牌（lg:hidden） */}
          <div className="lg:hidden text-center mb-10">
            <div className="flex justify-center mb-4">
              <FoxLogo.Light size={48} />
            </div>
            <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--ink-800)' }}>
              狐学
            </h1>
            <p className="text-xs tracking-[0.15em] mt-1" style={{ color: 'var(--fox)' }}>
              智能在线培训考试平台
            </p>
          </div>

          {/* 登录卡片 */}
          <div className="rounded-2xl p-8 md:p-10"
            style={{
              background: '#faf6ef',
              border: '1px solid var(--ink-100)',
              boxShadow: '0 4px 24px rgba(26,23,18,0.06), 0 1px 4px rgba(26,23,18,0.04)',
            }}>
            <h2 className="font-serif text-xl font-bold mb-1" style={{ color: 'var(--ink-800)' }}>
              欢迎回来
            </h2>
            <p className="text-xs mb-8" style={{ color: 'var(--ink-300)' }}>
              请登录您的账号
            </p>

            <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="space-y-5">
              {/* 用户名 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200"
                  style={{
                    background: '#faf6ef',
                    border: '1px solid var(--ink-200)',
                    color: 'var(--ink-800)',
                  }}
                  onFocus={e => e.target.style.borderColor = '#e87a30'}
                  onBlur={e => e.target.style.borderColor = 'var(--ink-200)'}
                />
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200"
                  style={{
                    background: '#faf6ef',
                    border: '1px solid var(--ink-200)',
                    color: 'var(--ink-800)',
                  }}
                  onFocus={e => e.target.style.borderColor = '#e87a30'}
                  onBlur={e => e.target.style.borderColor = 'var(--ink-200)'}
                />
              </div>

              {/* 验证码 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
                  验证码
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    placeholder="计算结果"
                    maxLength={4}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200"
                    style={{
                      background: '#faf6ef',
                      border: '1px solid var(--ink-200)',
                      color: 'var(--ink-800)',
                    }}
                    onFocus={e => e.target.style.borderColor = '#e87a30'}
                    onBlur={e => e.target.style.borderColor = 'var(--ink-200)'}
                  />
                  <button
                    type="button"
                    onClick={() => { fetchCaptcha(); setCaptchaAnswer(''); }}
                    className="flex-shrink-0 rounded-xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--ink-200)', background: '#faf6ef' }}
                    title="换一张"
                  >
                    <div dangerouslySetInnerHTML={{ __html: captchaSvg }} className="w-[110px] h-[42px] flex items-center justify-center" />
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="text-xs px-4 py-2.5 rounded-xl flex items-center gap-2"
                  style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-medium tracking-wider rounded-xl border-none cursor-pointer transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #e87a30 0%, #f5a061 100%)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(232,122,48,0.25)',
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,122,48,0.35)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 2px 8px rgba(232,122,48,0.25)'; }}
              >
                {loading ? '登录中…' : '登 录'}
              </button>
            </form>

            {/* 注册入口 */}
            <div className="text-center mt-6">
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>还没有账号？</span>
              <button onClick={() => router.push('/register')}
                className="text-xs bg-transparent border-none cursor-pointer ml-1 hover:underline"
                style={{ color: 'var(--fox)' }}>
                立即注册
              </button>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="text-center mt-6">
            <a href="/verify-certificate"
              className="inline-flex items-center gap-1.5 text-xs bg-transparent border-none cursor-pointer hover:underline"
              style={{ color: 'var(--fox)' }}>
              <span>🔍</span> 证书验证
            </a>
            <p className="text-xs mt-3" style={{ color: 'var(--ink-200)' }}>
              {settings?.footerText || 'FoxLearn · 跟着小狐狸，知识不迷路 🐾'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
