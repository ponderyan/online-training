'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error('用户名或密码错误');
      const data = await res.json();
      localStorage.setItem('user', JSON.stringify(data));
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
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
          {/* LOGO：狐狸图标 + 品牌名 */}
          <div className="flex justify-center mb-5">
            <FoxLogo.Light size={44} />
          </div>
          <p className="text-xs tracking-[0.2em]" style={{ color: 'var(--ink-300)' }}>
            智 能 组 卷 系 统
          </p>
          <div className="w-32 mx-auto my-4">
            <DecorativeLine />
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
            跟着小狐狸，知识不迷路 🐾
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

          <p className="text-xs text-center" style={{ color: 'var(--ink-300)' }}>
            测试账户：admin / admin_temp
          </p>
        </div>
      </div>

      {/* 底部版权 */}
      <p className="fixed bottom-6 text-xs" style={{ color: 'var(--ink-200)' }}>
        FoxLearn · 跟着小狐狸，知识不迷路 🐾
      </p>
    </div>
  );
}
