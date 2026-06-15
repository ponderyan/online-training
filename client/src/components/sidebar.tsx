'use client';

import { usePathname, useRouter } from 'next/navigation';
import FoxLogo from './fox-logo';

const navItems = [
  { path: '/dashboard', label: '工作台', icon: '📋' },
  { path: '/questions', label: '题库管理', icon: '📝' },
  { path: '/materials', label: '教材出题', icon: '📖' },
  { path: '/generate', label: '智能组卷', icon: '✨' },
  { path: '/papers', label: '试卷管理', icon: '📄' },
  { path: '/students', label: '学员管理', icon: '👥' },
  { path: '/settings', label: '系统设置', icon: '⚙️' },
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

      {/* Brand — FoxLearn LOGO */}
      <div className="px-6 py-6 border-b border-[rgba(196,188,176,0.08)]">
        <FoxLogo size={36} showText />
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
                background: isActive ? 'rgba(232, 122, 48, 0.1)' : 'transparent',
                color: isActive ? '#f5a061' : '#8b8174',
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
              <span className="w-5 text-center flex-shrink-0 text-sm">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-4 rounded-full" style={{ background: '#e87a30' }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-5 py-4 border-t border-[rgba(196,188,176,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: 'rgba(232, 122, 48, 0.15)',
              color: '#f5a061',
            }}>
            {user?.displayName?.[0] || '🦊'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#c4bcb0] truncate">{user?.displayName || '命题管理员'}</div>
            <div className="text-[11px] text-[#f5a061]">小狐狸的搭档 🐾</div>
          </div>
          <button onClick={handleLogout}
            className="text-[11px] text-[#8b8174] hover:text-[#e87a30] transition-colors bg-transparent border-none cursor-pointer flex-shrink-0 px-1">
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}
