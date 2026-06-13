'use client';

import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { path: '/', label: '工作台', icon: '≡' },
  { path: '/questions', label: '题库管理', icon: '☰' },
  { path: '/generate', label: '智能组卷', icon: '⚙' },
  { path: '/papers', label: '试卷管理', icon: '⊞' },
  { path: '/settings', label: '系统设置', icon: '⊜' },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: 'linear-gradient(180deg, #1a1712 0%, #231f1a 100%)',
      }}>

      {/* Brand */}
      <div className="px-6 py-6 border-b border-[rgba(196,188,176,0.08)]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #d9364a 0%, #b52a3a 100%)',
              boxShadow: '0 2px 8px rgba(217, 54, 74, 0.25)',
            }}>
            墨
          </div>
          <div>
            <div className="font-serif font-bold text-base text-white leading-tight tracking-wider">墨卷</div>
            <div className="text-[11px] text-[#8b8174] font-light tracking-widest mt-0.5">智能组卷系统</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const isActive = pathname === item.path;
          return (
            <div
              key={item.path}
              onClick={() => router.push(item.path)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer text-sm transition-all"
              style={{
                background: isActive ? 'rgba(201,160,58,0.1)' : 'transparent',
                color: isActive ? '#dbb95c' : '#8b8174',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(196,188,176,0.05)';
                  e.currentTarget.style.color = '#c4bcb0';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#8b8174';
                }
              }}
            >
              <span className="w-5 text-center text-sm opacity-40 flex-shrink-0">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-4 rounded-full" style={{ background: '#c9a03a' }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-5 py-4 border-t border-[rgba(196,188,176,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-serif text-sm font-bold flex-shrink-0"
            style={{
              background: 'rgba(201,160,58,0.15)',
              color: '#dbb95c',
            }}>
            {user?.displayName?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#c4bcb0] truncate">{user?.displayName || '用户'}</div>
            <div className="text-[11px] text-[#8b8174]">命题管理员</div>
          </div>
          <button onClick={handleLogout}
            className="text-[11px] text-[#8b8174] hover:text-[#d9364a] transition-colors bg-transparent border-none cursor-pointer flex-shrink-0 px-1">
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}
