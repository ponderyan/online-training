'use client';

import { usePathname, useRouter } from 'next/navigation';
import FoxLogo from './fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  perm?: string | null;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  isSuperAdminOnly?: boolean;
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: '工作台',
    items: [
      { path: '/dashboard', label: '工作台', icon: '📋', perm: null },
      { path: '/my/profile', label: '个人中心', icon: '👤', perm: null },
      { path: '/notifications', label: '消息通知', icon: '🔔', perm: 'notification:view' },
    ],
  },
  {
    title: '培训管理',
    items: [
      { path: '/programs', label: '培训班管理', icon: '📋' },
      { path: '/courses', label: '课程管理', icon: '📚' },
      { path: '/admin/video-courses', label: '视频课程', icon: '🎬' },
      { path: '/instructors', label: '讲师管理', icon: '👨‍🏫' },
      { path: '/students', label: '学员管理', icon: '👥' },
      { path: '/agencies', label: '招生机构', icon: '🏢' },
    ],
  },
  {
    title: '考务管理',
    items: [
      { path: '/questions', label: '题库管理', icon: '📝' },
      { path: '/materials', label: '教材出题', icon: '📖' },
      { path: '/generate', label: '智能组卷', icon: '✨' },
      { path: '/papers', label: '试卷管理', icon: '📄' },
      { path: '/exams', label: '考试管理', icon: '📋' },
      { path: '/proctoring', label: '监考中心', icon: '🎥' },
      { path: '/grading', label: '阅卷中心', icon: '📊' },
    ],
  },
  {
    title: '认证管理',
    items: [
      { path: '/admin/filing', label: '开班备案', icon: '🏛️' },
      { path: '/certificates', label: '证书管理', icon: '🎓' },
      { path: '/certificates/applications', label: '证书审批', icon: '📋' },
      { path: '/evaluations', label: '评价管理', icon: '⭐' },
    ],
  },
  {
    title: '审计管理',
    items: [
      { path: '/admin/audit-trail', label: '全链审计', icon: '🔍' },
      { path: '/audit-logs', label: '审计日志', icon: '📋' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { path: '/admin/organizations', label: '机构管理', icon: '🏢' },
      { path: '/settings', label: '系统设置', icon: '⚙️' },
      { path: '/admin/settings/branding', label: '品牌设置', icon: '🎨' },
      { path: '/admin/ai-configs', label: 'AI 配置', icon: '🤖' },
      { path: '/admin/messages', label: '消息中心', icon: '📢' },
      { path: '/admin/knowledge', label: '知识库管理', icon: '📚' },
      { path: '/admin/data', label: '数据管理', icon: '📦' },
    ],
  },
  {
    title: '权限中心',
    isSuperAdminOnly: true,
    items: [
      { path: '/accounts', label: '账户管理', icon: '👤' },
      { path: '/permissions', label: '权限管理', icon: '🔐' },
    ],
  },
];

const STUDENT_NAV_GROUPS: NavGroup[] = [
  {
    title: '我的学习',
    items: [
      { path: '/learning-center', label: '学习中心', icon: '📺' },
      { path: '/practice', label: '练习模式', icon: '📝' },
      { path: '/ai/assistant', label: 'AI 助教', icon: '🦊' },
    ],
  },
  {
    title: '考试中心',
    items: [
      { path: '/exam', label: '我的考试', icon: '📋' },
      { path: '/exam/results', label: '考试成绩', icon: '📊' },
    ],
  },
  {
    title: '我的档案',
    items: [
      { path: '/learning-hours', label: '我的学时', icon: '🕐' },
      { path: '/my-certificates', label: '我的证书', icon: '🎓' },
      { path: '/my/profile', label: '个人中心', icon: '👤' },
    ],
  },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const settings = useSiteSettings();
  const router = useRouter();

  const isStudent = user?.roles?.includes('STUDENT') && !user?.roles?.some((r: string) =>
    ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR'].includes(r)
  );

  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');
  const permissions: string[] = user?.permissions || [];
  const navGroups = isStudent ? STUDENT_NAV_GROUPS : ADMIN_NAV_GROUPS;

  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (group.isSuperAdminOnly && !isSuperAdmin) return false;
        if (item.perm && !permissions.includes(item.perm)) return false;
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="w-56 flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{ background: 'var(--card)', borderRight: '1px solid var(--ink-100)' }}>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <FoxLogo />
      </div>

      {/* User info */}
      <div className="px-4 pb-3 border-b" style={{ borderColor: 'var(--ink-100)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
            🦊
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--ink-700)' }}>
              {user?.displayName || '用户'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
              {user?.roleInfo?.[0]?.name || '小狐狸的搭档'} 🐾
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
        {visibleGroups.map(group => (
          <div key={group.title} className="mb-2">
            <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ink-300)' }}>
              {group.title}
            </div>
            {group.items.map(item => {
              const isActive = pathname === item.path || (
                pathname.startsWith(item.path + '/') &&
                !group.items.some(sibling =>
                  sibling.path !== item.path && (
                    pathname === sibling.path ||
                    pathname.startsWith(sibling.path + '/')
                  )
                )
              );
              return (
                <div key={item.path + item.label}
                  onClick={() => router.push(item.path)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer text-sm transition-all mx-2"
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
                  }}>
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && (
                    <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: '#e87a30' }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
