'use client';

import { usePathname, useRouter } from 'next/navigation';
import FoxLogo from './fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

const NAV_GROUPS = [
  {
    title: '工作台',
    items: [
      { path: '/dashboard', label: '工作台', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER', 'PROCTOR'] },
      { path: '/my/profile', label: '个人中心', icon: '👤', roles: ['ALL'] },
      { path: '/notifications', label: '消息通知', icon: '🔔', roles: ['ALL'] },
    ],
  },
  {
    title: '教学管理',
    items: [
      { path: '/programs', label: '培训班管理', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/courses', label: '课程管理', icon: '📚', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/video-courses', label: '视频课程', icon: '🎬', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/instructors', label: '讲师管理', icon: '👨‍🏫', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/students', label: '学员管理', icon: '👥', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
    ],
  },
  {
    title: '考试题库',
    items: [
      { path: '/questions', label: '题库管理', icon: '📝', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER', 'EXAM_OFFICER'] },
      { path: '/materials', label: '教材出题', icon: '📖', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER', 'EXAM_OFFICER'] },
      { path: '/generate', label: '智能组卷', icon: '✨', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER'] },
      { path: '/papers', label: '试卷管理', icon: '📄', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER'] },
      { path: '/exams', label: '考试管理', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER'] },
    ],
  },
  {
    title: '证书审计',
    items: [
      { path: '/admin/filing', label: '开班备案', icon: '🏢', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/certificates', label: '证书管理', icon: '🏅', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/certificates/applications', label: '证书审批', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/audit-trail', label: '全链审计', icon: '🔍', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/audit-logs', label: '审计日志', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
    ],
  },
  {
    title: '系统管理',
    items: [
      { path: '/admin/organizations', label: '机构管理', icon: '🏢', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/messages', label: '消息中心', icon: '📢', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/agencies', label: '招生机构', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/grading', label: '阅卷中心', icon: '📊', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER', 'EXAM_OFFICER'] },
      { path: '/proctoring', label: '监考中心', icon: '🎥', roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'PROCTOR', 'EXAM_OFFICER'] },
      { path: '/evaluations', label: '评价管理', icon: '📋', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/accounts', label: '账户管理', icon: '👤', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/permissions', label: '权限管理', icon: '🔐', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/settings', label: '系统设置', icon: '⚙️', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/data', label: '数据管理', icon: '📦', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/settings/branding', label: '品牌设置', icon: '🎨', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/ai-configs', label: 'AI 配置', icon: '🤖', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      { path: '/admin/knowledge', label: '知识库管理', icon: '📚', roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
    ],
  },
  {
    title: '学员空间',
    items: [
      { path: '/learning-center', label: '学习中心', icon: '📺', roles: ['STUDENT', 'SUPER_ADMIN'] },
      { path: '/practice', label: '练习模式', icon: '📝', roles: ['STUDENT', 'SUPER_ADMIN'] },
      { path: '/exam', label: '我的考试', icon: '📋', roles: ['STUDENT', 'SUPER_ADMIN'] },
      { path: '/learning-hours', label: '我的学时', icon: '📊', roles: ['STUDENT', 'SUPER_ADMIN'] },
      { path: '/my-certificates', label: '我的证书', icon: '🎓', roles: ['STUDENT', 'SUPER_ADMIN'] },
      { path: '/ai/assistant', label: 'AI 助教', icon: '🦊', roles: ['STUDENT', 'SUPER_ADMIN'] },
    ],
  },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const settings = useSiteSettings();
  const router = useRouter();

  // Filter groups based on user role (ALL means every role)
  const filteredGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes('ALL') || user?.roles?.some((r: string) => item.roles.includes(r))),
    }))
    .filter(group => group.items.length > 0);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (filteredGroups.length === 0) return null;

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: 'linear-gradient(180deg, #1a1712 0%, #231f1a 100%)' }}>
      <div className="px-6 py-6 border-b border-[rgba(196,188,176,0.08)]">
        <div className="flex items-center gap-3">
          <FoxLogo size={36} />
          <div className="font-serif font-bold leading-tight tracking-wider text-white">
            {settings?.siteName || 'FoxLearn'}
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredGroups.map(group => (
          <div key={group.title}>
            {!user?.roles?.includes('STUDENT') && (
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: 'var(--ink-400)' }}>
                {group.title}
              </div>
            )}
            {group.items.map(item => {
              const isActive = pathname === item.path || (
                pathname.startsWith(item.path + '/') &&
                !group.items.some(sibling =>
                  sibling.path !== item.path && pathname.startsWith(sibling.path + '/')
                )
              );
              return (
                <div key={item.path + item.label} onClick={() => router.push(item.path)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer text-sm transition-all"
                  style={{ background: isActive ? 'rgba(232, 122, 48, 0.1)' : 'transparent', color: isActive ? '#f5a061' : '#8b8174' }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(196,188,176,0.05)'; e.currentTarget.style.color = '#c4bcb0'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b8174'; } }}>
                  <span className="w-5 text-center flex-shrink-0 text-sm">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {isActive && <span className="ml-auto w-1 h-4 rounded-full" style={{ background: '#e87a30' }} />}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-[rgba(196,188,176,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(232, 122, 48, 0.15)', color: '#f5a061' }}>
            {user?.displayName?.[0] || '🦊'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#c4bcb0] truncate">{user?.displayName || ''}</div>
            <div className="text-[11px] text-[#f5a061]">
              {user?.roles?.includes('STUDENT') ? '学员' : user?.roles?.includes('SUPER_ADMIN') ? '超级管理员' : user?.roles?.includes('ORG_ADMIN') ? '机构管理员' : user?.roles?.includes('LECTURER') ? '讲师' : user?.roles?.includes('EXAM_OFFICER') ? '考务员'
          : user?.roles?.includes('PROCTOR') ? '监考员' : '小狐狸的搭档'} 🐾
            </div>
          </div>
          <button onClick={handleLogout} className="text-[11px] text-[#8b8174] hover:text-[#e87a30] transition-colors bg-transparent border-none cursor-pointer flex-shrink-0 px-1">退出</button>
        </div>
      </div>
    </aside>
  );
}
