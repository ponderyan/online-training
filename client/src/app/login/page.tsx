'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      router.push('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #efe9dc 0%, #e4dccd 50%, #f6f1e8 100%)' }}>
      {/* 顶部装饰线 */}
      <div className="fixed top-0 left-0 w-full h-[3px]"
        style={{ background: 'linear-gradient(90deg, #c9a03a, #d9364a, #c9a03a)' }} />

      <div className="card w-[380px] p-8 animate-fadeSlide">
        {/* 品牌区 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #d9364a 0%, #b52a3a 100%)',
              boxShadow: '0 4px 16px rgba(217, 54, 74, 0.3)',
            }}>
            墨
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-wider" style={{ color: 'var(--ink-800)' }}>墨卷</h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--ink-400)' }}>智能组卷系统</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>用户名</label>
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
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>密码</label>
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
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn btn-ink w-full py-3 text-sm"
          >
            {loading ? '登录中…' : '登 录'}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--ink-300)' }}>
            测试账户：admin / admin_temp
          </p>
        </div>
      </div>
    </div>
  );
}
