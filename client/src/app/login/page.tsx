'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

function DecorativeLine() {
  return (
    <svg viewBox="0 0 200 2" className="w-full">
      <line x1="0" y1="1" x2="60" y2="1" stroke="#e87a30" strokeWidth="1" opacity="0.4" />
      <circle cx="70" cy="1" r="1.5" fill="#e87a30" opacity="0.5" />
      <line x1="75" y1="1" x2="125" y2="1" stroke="#5a5348" strokeWidth="0.5" opacity="0.3" />
      <circle cx="130" cy="1" r="1.5" fill="#e87a30" opacity="0.5" />
      <line x1="135" y1="1" x2="200" y2="1" stroke="#e87a30" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

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
      // 保存 JWT token + 用户信息
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      // 角色分流
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
      fetchCaptcha();
      setCaptchaAnswer('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #f6f1e8 0%, #efe9dc 50%, #e4dccd 100%)',
      }}>
      {/* 顶部装饰线 */}
      <div className="fixed top-0 left-0 w-full h-[3px]"
        style={{ background: 'linear-gradient(90deg, transparent, #e87a30 20%, #f5a061 50%, #e87a30 80%, transparent)' }} />

      <div className="card w-[400px] p-10 animate-fadeSlide">
        {/* ── 品牌区 ── */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            {settings?.siteLogo ? <img src={settings.siteLogo} alt="logo" style={{ height: 44 }} /> : <FoxLogo.Light size={44} />}
          </div>
          <p className="text-xs tracking-[0.2em]" style={{ color: 'var(--ink-300)' }}>
            {settings?.siteTitle || '智 能 组 卷 系 统'}
          </p>
          <div className="w-32 mx-auto my-4">
            <DecorativeLine />
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
            {settings?.footerText || '跟着小狐狸，知识不迷路 🐾'}
          </p>
        </div>

        {/* ── 表单 ── */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="请输入用户名"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="请输入密码"
              className="input"
            />
          </div>

          {/* ── 验证码 ── */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              验证码
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={captchaAnswer}
                onChange={e => setCaptchaAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="计算结果"
                className="input flex-1"
                maxLength={4}
              />
              <button
                type="button"
                onClick={() => { fetchCaptcha(); setCaptchaAnswer(''); }}
                className="flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--ink-200)', background: '#faf8f5' }}
                title="换一张"
              >
                <div dangerouslySetInnerHTML={{ __html: captchaSvg }} className="w-[120px] h-[44px] flex items-center justify-center" />
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs px-4 py-2.5 rounded-lg flex items-center gap-2"
              style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn btn-fox w-full py-3 text-sm tracking-wider"
          >
            {loading ? '登录中…' : '登 录'}
          </button>
        </div>
      </div>

      <div className="text-center mt-4">
        <span className="text-xs" style={{ color: 'var(--ink-300)' }}>还没有账号？</span>
        <button onClick={() => router.push('/register')}
          className="text-xs bg-transparent border-none cursor-pointer ml-1" style={{ color: 'var(--fox)' }}>
          立即注册
        </button>
      </div>


      {/* 底部版权 */}
      <div className="fixed bottom-6 text-xs text-center" style={{ color: 'var(--ink-200)' }}>
        <a href="/verify-certificate" className="inline-block mb-1 bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)', textDecoration: 'none' }}>🔍 证书验证</a>
        <p>{settings?.footerText || 'FoxLearn · 跟着小狐狸，知识不迷路 🐾'}{settings?.icpBeian ? ` · ${settings.icpBeian}` : ''}</p>
      </div>
    </div>
  );
}
