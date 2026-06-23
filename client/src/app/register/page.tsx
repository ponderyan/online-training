'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirmPwd: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.username || !form.displayName || !form.password) { setError('请填写必填项'); return; }
    if (form.password !== form.confirmPwd) { setError('两次密码不一致'); return; }
    if (form.password.length < 6) { setError('密码至少6位'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          phone: form.phone || undefined,
          email: form.email || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }

      // 注册成功，自动登录
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/exam');
    } catch (e: any) { setError('注册失败：' + e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f6f1e8 0%, #efe9dc 50%, #e4dccd 100%)' }}>
      <div className="fixed top-0 left-0 w-full h-[3px]"
        style={{ background: 'linear-gradient(90deg, transparent, #e87a30 20%, #f5a061 50%, #e87a30 80%, transparent)' }} />

      <div className="card w-[420px] p-8 animate-fadeSlide">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🦊</div>
          <h1 className="font-serif font-bold text-lg" style={{ color: 'var(--ink-700)' }}>注册 FoxLearn</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>跟着小狐狸，知识不迷路 🐾</p>
        </div>

        {error && (
          <div className="text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 mb-4"
            style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
            <span>⚠</span> {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>用户名 *</label>
            <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
              className="input" placeholder="登录用" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>姓名 *</label>
            <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})}
              className="input" placeholder="真实姓名" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>密码 *</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="input" placeholder="至少6位" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>确认密码 *</label>
              <input type="password" value={form.confirmPwd} onChange={e => setForm({...form, confirmPwd: e.target.value})}
                className="input" placeholder="再次输入" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>手机号</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="input" placeholder="选填" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>邮箱</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="input" placeholder="选填" />
            </div>
          </div>

          <button onClick={handleRegister} disabled={loading}
            className="btn btn-fox w-full py-3 text-sm tracking-wider mt-2">
            {loading ? '注册中…' : '注 册'}
          </button>
        </div>

        <div className="text-center mt-5">
          <span className="text-xs" style={{ color: 'var(--ink-300)' }}>已有账号？</span>
          <button onClick={() => router.push('/login')}
            className="text-xs bg-transparent border-none cursor-pointer ml-1" style={{ color: 'var(--fox)' }}>
            立即登录
          </button>
        </div>
      </div>
    </div>
  );
}
