'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

// ── 输入框 icon SVG（与登录页一致）──
const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const IdIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="12" r="2" />
    <path d="M14 11h4M14 14h4" />
  </svg>
);
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);
const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const inputClass = "peer w-full pl-[42px] pr-3.5 py-3 text-sm rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] text-[var(--ink-800)] outline-none transition-all placeholder:text-[var(--ink-200)] focus:border-[var(--fox)] focus:ring-[3px] focus:ring-[var(--fox-glow)]";

function Field({ label, icon, children, required }: { label: string; icon: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--ink-500)] mb-1.5 tracking-[0.02em]">
        {label} {required && <span style={{ color: 'var(--verm)' }}>*</span>}
      </label>
      <div className="relative">
        {children}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--ink-200)] peer-focus:text-[var(--fox)] transition-colors pointer-events-none flex items-center justify-center">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirmPwd: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

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
      if (data.error) { setError(data.error); setLoading(false); return; }

      // 注册成功，先展示反馈再跳转
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (e: any) { setError('注册失败：' + e.message); setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      {/* ═══ 左侧品牌展示区（与登录页一致）═══ */}
      <div className="hidden lg:flex w-[46%] flex-col items-center justify-center relative overflow-hidden min-h-screen"
        style={{ background: 'linear-gradient(160deg, #1a1712 0%, #231f1a 40%, #2c261e 70%, #1a1712 100%)' }}>
        {/* 背景纹理 */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 20% 30%, rgba(232,122,48,0.06) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,160,58,0.04) 0%, transparent 40%)' }} />
        {/* 狐狸轮廓 SVG 装饰 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
          <svg width="600" height="700" viewBox="0 0 800 900" fill="none">
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
        {/* 浮动光点 */}
        <div className="absolute rounded-full pointer-events-none animate-[float_8s_ease-in-out_infinite]"
          style={{ width: 280, height: 280, top: -60, right: -80, background: 'radial-gradient(circle, rgba(232,122,48,0.15), transparent 70%)' }} />
        <div className="absolute rounded-full pointer-events-none animate-[float_8s_ease-in-out_infinite]"
          style={{ width: 200, height: 200, bottom: 40, left: -40, background: 'radial-gradient(circle, rgba(201,160,58,0.10), transparent 70%)', animationDelay: '-3s' }} />
        <div className="absolute rounded-full pointer-events-none animate-[float_8s_ease-in-out_infinite]"
          style={{ width: 120, height: 120, top: '40%', left: '15%', background: 'radial-gradient(circle, rgba(245,160,97,0.08), transparent 70%)', animationDelay: '-5s' }} />

        {/* 品牌内容 */}
        <div className="relative z-10 text-center px-15">
          <div className="mb-7 flex justify-center"><FoxLogo size={72} /></div>
          <h1 className="font-serif text-[42px] font-black tracking-[0.08em] text-white mb-3">狐学</h1>
          <p className="text-[15px] tracking-[0.2em] font-light text-[var(--fox-light)]">智能在线培训考试平台</p>
          <div className="flex items-center justify-center gap-3 mt-8 mb-3">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--fox)]" />
            <span className="text-xs tracking-widest text-[var(--ink-400)]">加入狐学</span>
            <span className="w-12 h-px bg-gradient-to-r from-[var(--fox)] to-transparent" />
          </div>
          <p className="text-[13px] text-[var(--ink-300)]">开启你的学习之旅 🐾</p>
        </div>

        {/* 特性列表 */}
        <div className="relative z-10 flex flex-col gap-4 mt-12 px-15">
          {[
            '协会培训 · 继续教育学时全流程管理',
            '智能组卷 · AI 出题与自动阅卷',
            '证书防伪 · 区块链级溯源验证',
          ].map(text => (
            <div key={text} className="flex items-center gap-3 text-[13px] text-[var(--ink-300)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--fox)] shadow-[0_0_8px_rgba(232,122,48,0.4)] flex-shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-6 text-[11px] tracking-wider text-[var(--ink-500)] z-10">
          © 2026 FoxLearn · 狐学智能培训考试系统
        </div>
      </div>

      {/* ═══ 右侧注册表单区 ═══ */}
      <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-[var(--paper-light)] via-[var(--paper)] to-[var(--paper-alt)]">
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[420px] mx-auto px-6 py-10">

            {/* 移动端品牌（lg:hidden） */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex justify-center mb-3"><FoxLogo.Light size={48} /></div>
              <h1 className="font-serif text-2xl font-bold text-[var(--ink-800)]">狐学</h1>
              <p className="text-xs tracking-[0.15em] mt-1 text-[var(--fox)]">智能在线培训考试平台</p>
            </div>

            {/* 注册卡片 */}
            <div className="bg-[var(--paper-bright)] border border-[var(--ink-100)] rounded-2xl p-10 shadow-[0_4px_24px_rgba(26,23,18,0.06),0_1px_4px_rgba(26,23,18,0.04)] animate-fadeSlide">
              {success ? (
                /* 注册成功反馈 */
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'var(--sage-glow)' }}>
                    <span className="text-3xl" style={{ color: 'var(--sage)' }}>✓</span>
                  </div>
                  <h2 className="font-serif text-xl font-bold text-[var(--ink-800)] mb-2">注册成功</h2>
                  <p className="text-sm text-[var(--ink-400)]">正在进入工作台…</p>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <h2 className="font-serif text-[22px] font-bold text-[var(--ink-800)] mb-1.5">创建账号</h2>
                    <p className="text-[13px] text-[var(--ink-300)]">填写信息，开启学习之旅</p>
                  </div>

                  <form onSubmit={e => { e.preventDefault(); handleRegister(); }}>
                    <div className="space-y-4">
                      <Field label="用户名" icon={<UserIcon className="w-[18px] h-[18px]" />} required>
                        <input value={form.username} onChange={set('username')} placeholder="登录用户名" autoFocus className={inputClass} />
                      </Field>
                      <Field label="姓名" icon={<IdIcon className="w-[18px] h-[18px]" />} required>
                        <input value={form.displayName} onChange={set('displayName')} placeholder="真实姓名" className={inputClass} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="密码" icon={<LockIcon className="w-[18px] h-[18px]" />} required>
                          <input type="password" value={form.password} onChange={set('password')} placeholder="至少6位" className={inputClass} />
                        </Field>
                        <Field label="确认密码" icon={<LockIcon className="w-[18px] h-[18px]" />} required>
                          <input type="password" value={form.confirmPwd} onChange={set('confirmPwd')} placeholder="再次输入" className={inputClass} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="手机号" icon={<PhoneIcon className="w-[18px] h-[18px]" />}>
                          <input value={form.phone} onChange={set('phone')} placeholder="选填" className={inputClass} />
                        </Field>
                        <Field label="邮箱" icon={<MailIcon className="w-[18px] h-[18px]" />}>
                          <input value={form.email} onChange={set('email')} placeholder="选填" className={inputClass} />
                        </Field>
                      </div>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                      <div className="flex items-center gap-2 px-3.5 py-2.5 mt-4 text-xs rounded-lg bg-[var(--verm-glow)] border border-[rgba(217,54,74,0.2)] text-[var(--verm)] animate-shake">
                        <span>⚠</span> {error}
                      </div>
                    )}

                    {/* 注册按钮 — 渐变背景，与登录页一致 */}
                    <button type="submit" disabled={loading}
                      className="group relative w-full py-3 mt-6 text-sm font-medium tracking-wider text-white rounded-lg overflow-hidden transition-all duration-200 bg-gradient-to-br from-[var(--fox)] to-[var(--fox-light)] shadow-[0_2px_8px_rgba(232,122,48,0.25)] hover:shadow-[0_4px_16px_rgba(232,122,48,0.35)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
                      <span className="relative z-10">{loading ? '注册中…' : '注 册'}</span>
                      <span className="absolute inset-0 -left-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-500 group-hover:left-full" />
                    </button>
                  </form>

                  {/* 登录入口 */}
                  <div className="text-center mt-6">
                    <span className="text-xs text-[var(--ink-300)]">已有账号？</span>
                    <button onClick={() => router.push('/login')}
                      className="text-xs bg-transparent border-none cursor-pointer ml-1 text-[var(--fox)] hover:underline">
                      立即登录
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 底部 */}
            <div className="text-center mt-6">
              <p className="text-[11px] text-[var(--ink-200)]">
                {settings?.footerText || 'FoxLearn · 跟着小狐狸，知识不迷路 🐾'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
