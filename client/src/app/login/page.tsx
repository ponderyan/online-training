'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FoxLogo from '@/components/fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

// ── 输入框 icon SVG 组件 ──
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
const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);
const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const BoltIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

// ── 角色快捷登录（开发演示用） ──
const QUICK_ROLES = [
  { username: 'admin',        password: 'admin_temp', label: '管理员' },
  { username: 'org_admin',    password: '123456',     label: '机构管理' },
  { username: 'exam_officer', password: '123456',     label: '考务员' },
  { username: 'lecturer01',   password: '123456',     label: '讲师' },
  { username: 'proctor01',    password: '123456',     label: '监考员' },
  { username: 'agency_admin', password: '123456',     label: '招生机构' },
  { username: 'auditor01',    password: '123456',     label: '审计员' },
  { username: 'stu001',       password: '123456',     label: '学员' },
];

export default function LoginPage() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [showQuickLogin, setShowQuickLogin] = useState(false);

  // ── 已登录用户回退到登录页时自动跳回 dashboard ──
  useEffect(() => {
    const push = () => {
      const token = localStorage.getItem('token');
      if (token) router.push('/dashboard');
    };
    push();
    // Safari bfcache：后退到 /login 时页面从缓存恢复，useEffect 不重跑，router.push
    // 也可能被冻结。用 window.location.href 做硬跳转兜底。
    window.addEventListener('pageshow', (e) => {
      if (e.persisted && localStorage.getItem('token')) {
        window.location.href = '/dashboard';
      }
    });
  }, [router]);
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
    <div className="flex min-h-screen">
      {/* ═══ 左侧品牌展示区 ═══ */}
      <div className="hidden lg:flex w-[46%] flex-col items-center justify-center relative overflow-hidden min-h-screen"
        style={{
          background: 'linear-gradient(160deg, #1a1712 0%, #231f1a 40%, #2c261e 70%, #1a1712 100%)',
        }}>
        {/* 背景纹理 */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 20% 30%, rgba(232,122,48,0.06) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,160,58,0.04) 0%, transparent 40%)',
          }} />
        {/* 狐狸轮廓 SVG装饰 */}
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
          <div className="mb-7 flex justify-center">
            <FoxLogo size={72} />
          </div>
          <h1 className="font-serif text-[42px] font-black tracking-[0.08em] text-white mb-3">
            狐学
          </h1>
          <p className="text-[15px] tracking-[0.2em] font-light text-[var(--fox-light)]">
            智能在线培训考试平台
          </p>

          <div className="flex items-center justify-center gap-3 mt-8 mb-3">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--fox)]" />
            <span className="text-xs tracking-widest text-[var(--ink-400)]">跟着小狐狸</span>
            <span className="w-12 h-px bg-gradient-to-r from-[var(--fox)] to-transparent" />
          </div>
          <p className="text-[13px] text-[var(--ink-300)]">
            知识不迷路 🐾
          </p>
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

        {/* 底部版本/备案 */}
        <div className="absolute bottom-6 text-[11px] tracking-wider text-[var(--ink-500)] z-10">
          © 2026 FoxLearn · 狐学智能培训考试系统
        </div>
      </div>

      {/* ═══ 右侧登录表单区 ═══ */}
      <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-[var(--paper-light)] via-[var(--paper)] to-[var(--paper-alt)]">
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[400px] mx-auto px-6 py-10">

          {/* 移动端品牌（lg:hidden） */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-3">
              <FoxLogo.Light size={48} />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[var(--ink-800)]">狐学</h1>
            <p className="text-xs tracking-[0.15em] mt-1 text-[var(--fox)]">智能在线培训考试平台</p>
          </div>

          {/* 登录卡片 */}
          <div className="bg-[var(--paper-bright)] border border-[var(--ink-100)] rounded-2xl p-10 shadow-[0_4px_24px_rgba(26,23,18,0.06),0_1px_4px_rgba(26,23,18,0.04)]">
            <div className="mb-8">
              <h2 className="font-serif text-[22px] font-bold text-[var(--ink-800)] mb-1.5">欢迎回来</h2>
              <p className="text-[13px] text-[var(--ink-300)]">请登录您的账号</p>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleLogin(); }}>
              {/* 用户名 */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[var(--ink-500)] mb-1.5 tracking-[0.02em]">用户名</label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoFocus
                    className="peer w-full pl-[42px] pr-3.5 py-3 text-sm rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] text-[var(--ink-800)] outline-none transition-all placeholder:text-[var(--ink-200)] focus:border-[var(--fox)] focus:ring-[3px] focus:ring-[var(--fox-glow)]"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--ink-200)] peer-focus:text-[var(--fox)] transition-colors pointer-events-none flex items-center justify-center">
                    <UserIcon className="w-[18px] h-[18px]" />
                  </span>
                </div>
              </div>

              {/* 密码 */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[var(--ink-500)] mb-1.5 tracking-[0.02em]">密码</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="peer w-full pl-[42px] pr-3.5 py-3 text-sm rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] text-[var(--ink-800)] outline-none transition-all placeholder:text-[var(--ink-200)] focus:border-[var(--fox)] focus:ring-[3px] focus:ring-[var(--fox-glow)]"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--ink-200)] peer-focus:text-[var(--fox)] transition-colors pointer-events-none flex items-center justify-center">
                    <LockIcon className="w-[18px] h-[18px]" />
                  </span>
                </div>
              </div>

              {/* 验证码 */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-[var(--ink-500)] mb-1.5 tracking-[0.02em]">验证码</label>
                <div className="flex gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={captchaAnswer}
                      onChange={e => setCaptchaAnswer(e.target.value)}
                      placeholder="计算结果"
                      maxLength={4}
                      className="peer w-full pl-[42px] pr-3.5 py-3 text-sm rounded-lg bg-[var(--paper-bright)] border-[1.5px] border-[var(--ink-100)] text-[var(--ink-800)] outline-none transition-all placeholder:text-[var(--ink-200)] focus:border-[var(--fox)] focus:ring-[3px] focus:ring-[var(--fox-glow)]"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--ink-200)] peer-focus:text-[var(--fox)] transition-colors pointer-events-none flex items-center justify-center">
                      <CheckIcon className="w-[18px] h-[18px]" />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { fetchCaptcha(); setCaptchaAnswer(''); }}
                    className="flex-shrink-0 w-[110px] h-[44px] rounded-lg overflow-hidden border-[1.5px] border-[var(--ink-100)] bg-[var(--paper)] cursor-pointer hover:border-[var(--fox)] hover:opacity-85 transition-all"
                    title="换一张"
                  >
                    <div dangerouslySetInnerHTML={{ __html: captchaSvg }}
                      className="w-full h-full flex items-center justify-center" />
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 mb-5 text-xs rounded-lg bg-[var(--verm-glow)] border border-[rgba(217,54,74,0.2)] text-[var(--verm)] animate-shake">
                  <span>⚠</span> {error}
                </div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 text-sm font-medium tracking-wider text-white rounded-lg overflow-hidden transition-all duration-200 bg-gradient-to-br from-[var(--fox)] to-[var(--fox-light)] shadow-[0_2px_8px_rgba(232,122,48,0.25)] hover:shadow-[0_4px_16px_rgba(232,122,48,0.35)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">{loading ? '登录中…' : '登 录'}</span>
                <span className="absolute inset-0 -left-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-500 group-hover:left-full" />
              </button>
            </form>

            {/* 注册入口 */}
            <div className="text-center mt-6">
              <span className="text-xs text-[var(--ink-300)]">还没有账号？</span>
              <button onClick={() => router.push('/register')}
                className="text-xs bg-transparent border-none cursor-pointer ml-1 text-[var(--fox)] hover:underline">
                立即注册
              </button>
            </div>
          </div>

          {/* 快捷登录（开发演示用，可收起） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-5 bg-[var(--paper)] border border-dashed border-[var(--ink-100)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowQuickLogin(v => !v)}
                className="w-full flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-[var(--ink-400)] tracking-wide bg-transparent border-none cursor-pointer hover:text-[var(--ink-600)] transition-colors"
              >
                <BoltIcon className="w-3 h-3" />
                快捷登录（开发演示用）
                <span className="ml-auto">{showQuickLogin ? '▾' : '▸'}</span>
              </button>
              {showQuickLogin && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_ROLES.map(r => (
                      <button
                        key={r.username}
                        type="button"
                        onClick={() => { setUsername(r.username); setPassword(r.password); }}
                        className="py-1.5 px-1 text-[11px] text-center rounded-md border border-[var(--ink-100)] bg-[var(--paper-bright)] text-[var(--ink-500)] hover:border-[var(--fox)] hover:text-[var(--fox)] hover:bg-[var(--fox-glow)] transition-all"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 底部操作区 */}
          <div className="text-center mt-6">
            <a href="/verify-certificate"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--fox)] no-underline px-3 py-1.5 rounded-lg hover:bg-[var(--fox-glow)] transition-colors">
              <SearchIcon className="w-3.5 h-3.5" />
              证书验证
            </a>
            <p className="text-[11px] text-[var(--ink-200)] mt-3">
              {settings?.footerText || 'FoxLearn · 跟着小狐狸，知识不迷路 🐾'}
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
