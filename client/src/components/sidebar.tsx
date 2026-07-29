'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FoxLogo from './fox-logo';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { api } from '@/lib/api';

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
      { path: '/admin/dashboard', label: '统计看板', icon: '📊', perm: 'stats:view' },
    ],
  },
  {
    title: '培训管理',
    items: [
      { path: '/programs', label: '培训班管理', icon: '📋', perm: 'program:view' },
      { path: '/courses', label: '课程管理', icon: '📚', perm: 'course:view' },
      { path: '/admin/video-courses', label: '视频课程', icon: '🎬', perm: 'course:view' },
      { path: '/instructors', label: '讲师管理', icon: '👨‍🏫', perm: 'instructor:view' },
      { path: '/students', label: '学员管理', icon: '👥', perm: 'student:view' },
      { path: '/agencies', label: '招生机构', icon: '🏢', perm: 'agency:view' },
      { path: '/admin/agency-students', label: '机构学员', icon: '👥', perm: 'agency:view:students' },
      { path: '/admin/learning-hours', label: '学时管理', icon: '⏱', perm: 'learningHour:manage' },
      { path: '/admin/learning-hour-types', label: '学时类型', icon: '📋', perm: 'learningHour:manage' },
    ],
  },
  {
    title: '考务管理',
    items: [
      { path: '/questions', label: '题库管理', icon: '📝', perm: 'question:create' },
      { path: '/admin/subjects', label: '科目管理', icon: '📚', perm: 'question:create' },
      { path: '/admin/knowledge-points', label: '知识点管理', icon: '🧠', perm: 'knowledge:view' },
      { path: '/materials', label: '教材出题', icon: '📖', perm: 'material:upload' },
      { path: '/generate', label: '智能组卷', icon: '✨', perm: 'paper:generate' },
      { path: '/papers', label: '试卷管理', icon: '📄', perm: 'paper:view' },
      { path: '/exams', label: '考试管理', icon: '📋', perm: 'exam:view' },
      { path: '/proctoring', label: '监考中心', icon: '🎥', perm: 'proctor:view' },
      { path: '/grading', label: '阅卷中心', icon: '📊', perm: 'grading:manual' },
    ],
  },
  {
    title: '认证管理',
    items: [
      { path: '/admin/filing', label: '开班备案', icon: '🏛️', perm: 'program:view' },
      { path: '/certificates', label: '证书管理', icon: '🎓', perm: 'cert:view' },
      { path: '/certificates/applications', label: '证书审批', icon: '📋', perm: 'cert:application_view' },
      { path: '/evaluations', label: '评价管理', icon: '⭐', perm: 'evaluation:view' },
      { path: '/admin/learning-hours-review', label: '学时审核', icon: '⏱', perm: 'learningHour:approve' },
      { path: '/admin/learning-hour-certificates', label: '学时证明', icon: '📜', perm: 'learningHour:manage' },
    ],
  },
  {
    title: '审计管理',
    items: [
      { path: '/admin/audit-trail', label: '全链审计', icon: '🔍', perm: 'auditLog:view' },
      { path: '/audit-logs', label: '审计日志', icon: '📋', perm: 'auditLog:view' },
      { path: '/admin/audit-settings', label: '归档配置', icon: '⚙️', perm: 'auditLog:view' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { path: '/admin/organizations', label: '组织管理', icon: '🏢', perm: 'org:view' },
      { path: '/admin/settings/branding', label: '品牌设置', icon: '🎨', perm: 'system:config' },
      { path: '/admin/system-config', label: '配置中心', icon: '⚙️', perm: 'systemConfig:view' },
      { path: '/admin/ai-configs', label: 'AI 配置', icon: '🤖', perm: 'aiConfig:view' },
      { path: '/admin/messages', label: '消息中心', icon: '📢', perm: 'notice:manage' },
      { path: '/admin/knowledge', label: '知识库管理', icon: '📚', perm: 'aiConfig:view' },
      { path: '/admin/data', label: '数据管理', icon: '📦', perm: 'system:config' },
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
      { path: '/video', label: '视频课程', icon: '🎬' },
    ],
  },
  {
    title: '我的档案',
    items: [
      { path: '/learning-report', label: '学习报告', icon: '📊' },
      { path: '/learning-hours', label: '我的学时', icon: '🕐' },
      { path: '/my-certificates', label: '我的证书', icon: '🎓' },
      { path: '/my/profile', label: '个人中心', icon: '👤' },
      { path: '/notifications', label: '消息通知', icon: '🔔' },
    ],
  },
];

/** AGENCY_ADMIN 专属导航（纯机构管理员，非超管/组织管理员） */
const AGENCY_ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: '工作台',
    items: [
      { path: '/dashboard', label: '工作台', icon: '📋', perm: null },
      { path: '/my/profile', label: '个人中心', icon: '👤', perm: null },
      { path: '/notifications', label: '消息通知', icon: '🔔', perm: 'notification:view' },
    ],
  },
  {
    title: '机构管理',
    items: [
      { path: '/agencies', label: '我的机构', icon: '🏢', perm: 'agency:view' },
      { path: '/admin/agency-students', label: '学员管理', icon: '👥', perm: 'agency:view:students' },
      { path: '/agencies/radar', label: '招生雷达', icon: '📊', perm: 'agency:view' },
      { path: '/admin/learning-hours', label: '学时管理', icon: '⏱', perm: 'learningHour:manage' },
      { path: '/admin/learning-hour-types', label: '学时类型', icon: '📋', perm: 'learningHour:manage' },
    ],
  },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const settings = useSiteSettings();
  const router = useRouter();
  const [allowOrgOwnBank, setAllowOrgOwnBank] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    // 非 SUPER_ADMIN 才需要检查开关；SUPER_ADMIN 始终看到题库
    if (user?.roles && !user.roles.includes('SUPER_ADMIN')) {
      // 优先读缓存，避免每次导航都请求
      const cached = localStorage.getItem('bankPolicy_allow_org_own_bank');
      if (cached !== null) {
        setAllowOrgOwnBank(cached === 'true');
      }
      api.systemConfig.bankPolicy.get()
        .then(data => {
          setAllowOrgOwnBank(data.allow_org_own_bank);
          localStorage.setItem('bankPolicy_allow_org_own_bank', String(data.allow_org_own_bank));
        })
        .catch(() => {
          if (cached === null) setAllowOrgOwnBank(true);
        });
    }
  }, [user]);

  const isStudent = user?.roles?.includes('STUDENT') && !user?.roles?.some((r: string) =>
    ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR', 'AGENCY_ADMIN'].includes(r)
  );

  // 纯 AGENCY_ADMIN（不含 SUPER_ADMIN / ORG_ADMIN）使用专属导航
  const isPureAgencyAdmin = user?.roles?.includes('AGENCY_ADMIN')
    && !user?.roles?.includes('SUPER_ADMIN')
    && !user?.roles?.includes('ORG_ADMIN');

  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');
  const permissions: string[] = user?.permissions || [];
  const navGroups = isStudent ? STUDENT_NAV_GROUPS : isPureAgencyAdmin ? AGENCY_ADMIN_NAV_GROUPS : ADMIN_NAV_GROUPS;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/login');
  };

  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (group.isSuperAdminOnly && !isSuperAdmin) return false;
        if (isSuperAdmin) return true; // 超管看全部，无视权限缓存
        // 题库菜单：非SUPER_ADMIN且开关关闭时隐藏
        if (item.path === '/questions' && !isSuperAdmin && allowOrgOwnBank === false) return false;
        if (item.perm && !permissions.includes(item.perm)) return false;
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);

  return (
    <aside className={`${collapsed ? 'w-[64px]' : 'w-[240px]'} flex-shrink-0 flex flex-col h-screen sticky top-0 bg-gradient-to-b from-[var(--ink-900)] to-[var(--ink-800)] transition-all duration-200`}>
      {/* Logo */}
      <div className={`${collapsed ? 'px-3' : 'px-5'} py-6 border-b border-[rgba(196,188,176,0.08)]`}>
        <div className="flex items-center gap-3">
          <FoxLogo size={collapsed ? 30 : 36} />
          {!collapsed && (
            <div className="font-serif font-bold leading-tight tracking-wider text-white">
              {settings?.siteName || 'FoxLearn'}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleGroups.map(group => (
          <div key={group.title}>
            {!isStudent && !collapsed && (
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-400)]">
                {group.title}
              </div>
            )}
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
                <Link key={item.path + item.label} href={item.path} title={collapsed ? item.label : undefined}
                  className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-lg cursor-pointer text-sm transition-all no-underline ${
                    isActive
                      ? 'bg-[var(--fox-glow)] text-[var(--fox-light)]'
                      : 'text-[var(--ink-300)] hover:bg-[rgba(196,188,176,0.05)] hover:text-[var(--ink-100)]'
                  }`}>
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <span className="w-1 h-4 rounded-full flex-shrink-0 bg-[var(--fox)]" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-2 border-t border-[rgba(196,188,176,0.08)]">
        <button onClick={toggleCollapsed}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md text-[11px] text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[rgba(196,188,176,0.08)] transition-colors bg-transparent border-none cursor-pointer">
          {collapsed ? '»' : '« 收起'}
        </button>
      </div>
      {/* User info + logout */}
      <div className={`${collapsed ? 'px-2' : 'px-5'} py-4 border-t border-[rgba(196,188,176,0.08)]`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 bg-[var(--fox-glow-strong)] text-[var(--fox-light)]">
            {user?.displayName?.[0] || '🦊'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--ink-100)] truncate">{user?.displayName || ''}</div>
                <div className="text-[11px] text-[var(--fox-light)]">
                  {user?.roles?.includes('STUDENT') ? '学员'
                    : user?.roles?.includes('SUPER_ADMIN') ? '超级管理员'
                    : user?.roles?.includes('ORG_ADMIN') ? '机构管理员'
                    : user?.roles?.includes('LECTURER') ? '讲师'
                    : user?.roles?.includes('EXAM_OFFICER') ? '考务员'
                    : user?.roles?.includes('AGENCY_ADMIN') ? '招生机构管理员'
                    : user?.roles?.includes('PROCTOR') ? '监考员'
                    : '小狐狸的搭档'} 🐾
                </div>
              </div>
              <button onClick={handleLogout}
                className="text-[11px] text-[var(--ink-300)] hover:text-[var(--fox)] transition-colors bg-transparent border-none cursor-pointer flex-shrink-0 px-1">
                退出
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
