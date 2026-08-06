'use client';

import { useTheme, THEMES } from './theme-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FoxLogo from './fox-logo';
import {
  LayoutDashboard, User, Bell, BarChart3, ClipboardList, BookOpen, Video,
  GraduationCap, Users, Building2, Clock, FileText, Brain, BookMarked,
  Sparkles, FileCheck, MonitorPlay, Scale, Star, ScrollText, Search,
  Settings, Bot, Megaphone, Package, Shield, Lock, Tv, Pencil, PawPrint,
  Award, Palette, Timer, Landmark, ListChecks, Layers
} from 'lucide-react';

// 图标映射：字符串 key → Lucide 组件
const ICON_MAP: Record<string, React.ComponentType<{size?: number; className?: string}>> = {
  dashboard: LayoutDashboard, user: User, bell: Bell, chart: BarChart3,
  clipboard: ClipboardList, book: BookOpen, video: Video, instructor: GraduationCap,
  users: Users, building: Building2, clock: Clock, file: FileText,
  brain: Brain, material: BookMarked, sparkles: Sparkles, paper: FileCheck,
  exam: ClipboardList, proctor: MonitorPlay, grading: Scale, star: Star,
  scroll: ScrollText, search: Search, settings: Settings, bot: Bot,
  megaphone: Megaphone, package: Package, shield: Shield, lock: Lock,
  tv: Tv, pencil: Pencil, fox: PawPrint, award: Award, palette: Palette,
  timer: Timer, landmark: Landmark, checklist: ListChecks, layers: Layers,
  cert: Award, template: Palette, evaluation: Star, filing: Landmark,
};
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
      { path: '/dashboard', label: '工作台', icon: 'dashboard', perm: null },
      { path: '/my/profile', label: '个人中心', icon: 'user', perm: null },
      { path: '/notifications', label: '消息通知', icon: 'bell', perm: 'notification:view' },
      { path: '/admin/dashboard', label: '统计看板', icon: 'chart', perm: 'stats:view' },
    ],
  },
  {
    title: '培训管理',
    items: [
      { path: '/programs', label: '培训班管理', icon: 'clipboard', perm: 'program:view' },
      { path: '/courses', label: '课程管理', icon: 'book', perm: 'course:view' },
      { path: '/admin/video-courses', label: '视频课程', icon: 'video', perm: 'course:view' },
      { path: '/instructors', label: '讲师管理', icon: 'instructor', perm: 'instructor:view' },
      { path: '/students', label: '学员管理', icon: 'users', perm: 'student:view' },
      { path: '/agencies', label: '招生机构', icon: 'building', perm: 'agency:view' },
      { path: '/admin/agency-students', label: '机构学员', icon: 'users', perm: 'agency:view:students' },
      { path: '/admin/learning-hours', label: '学时管理', icon: 'timer', perm: 'learningHour:manage' },
      { path: '/admin/learning-hour-types', label: '学时类型', icon: 'layers', perm: 'learningHour:manage' },
    ],
  },
  {
    title: '考务管理',
    items: [
      { path: '/questions', label: '题库管理', icon: 'pencil', perm: 'question:create' },
      { path: '/admin/subjects', label: '科目管理', icon: 'book', perm: 'question:create' },
      { path: '/admin/knowledge-points', label: '知识点管理', icon: 'brain', perm: 'knowledge:view' },
      { path: '/materials', label: '教材出题', icon: 'material', perm: 'material:upload' },
      { path: '/generate', label: '智能组卷', icon: 'sparkles', perm: 'paper:generate' },
      { path: '/papers', label: '试卷管理', icon: 'paper', perm: 'paper:view' },
      { path: '/exams', label: '考试管理', icon: 'exam', perm: 'exam:view' },
      { path: '/proctoring', label: '监考中心', icon: 'proctor', perm: 'proctor:view' },
      { path: '/grading', label: '阅卷中心', icon: 'grading', perm: 'grading:manual' },
    ],
  },
  {
    title: '认证管理',
    items: [
      { path: '/admin/filing', label: '开班备案', icon: 'filing', perm: 'program:view' },
      { path: '/certificates', label: '证书管理', icon: 'cert', perm: 'cert:view' },
      { path: '/certificates/applications', label: '证书审批', icon: 'checklist', perm: 'cert:application_view' },
      { path: '/admin/certificate-templates', label: '证书模板', icon: 'template', perm: 'template:manage' },
      { path: '/evaluations', label: '评价管理', icon: 'evaluation', perm: 'evaluation:view' },
      { path: '/admin/learning-hours-review', label: '学时审核', icon: 'timer', perm: 'learningHour:approve' },
      { path: '/admin/learning-hour-certificates', label: '学时证明', icon: 'scroll', perm: 'learningHour:manage' },
    ],
  },
  {
    title: '审计管理',
    items: [
      { path: '/admin/audit-trail', label: '全链审计', icon: 'search', perm: 'auditLog:view' },
      { path: '/audit-logs', label: '审计日志', icon: 'file', perm: 'auditLog:view' },
      { path: '/admin/audit-settings', label: '归档配置', icon: 'settings', perm: 'auditLog:view' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { path: '/admin/organizations', label: '组织管理', icon: 'building', perm: 'org:view' },
      { path: '/admin/settings/branding', label: '品牌设置', icon: 'palette', perm: 'system:config' },
      { path: '/admin/settings/codes', label: '编码词典', icon: 'building', perm: 'system:config' },
      { path: '/admin/system-config', label: '配置中心', icon: 'settings', perm: 'systemConfig:view' },
      { path: '/admin/ai-configs', label: 'AI 配置', icon: 'bot', perm: 'aiConfig:view' },
      { path: '/admin/messages', label: '消息中心', icon: 'megaphone', perm: 'notice:manage' },
      { path: '/admin/knowledge', label: '知识库管理', icon: 'book', perm: 'aiConfig:view' },
      { path: '/admin/data', label: '数据管理', icon: 'package', perm: 'system:config' },
    ],
  },
  {
    title: '权限中心',
    isSuperAdminOnly: true,
    items: [
      { path: '/accounts', label: '账户管理', icon: 'user' },
      { path: '/permissions', label: '权限管理', icon: 'lock' },
    ],
  },
];

const STUDENT_NAV_GROUPS: NavGroup[] = [
  {
    title: '我的学习',
    items: [
      { path: '/learning-center', label: '学习中心', icon: 'tv' },
      { path: '/practice', label: '练习模式', icon: 'pencil' },
      { path: '/ai/assistant', label: 'AI 助教', icon: 'fox' },
    ],
  },
  {
    title: '考试中心',
    items: [
      { path: '/exam', label: '我的考试', icon: 'exam' },
      { path: '/exam/results', label: '考试成绩', icon: 'chart' },
      { path: '/video', label: '视频课程', icon: 'video' },
    ],
  },
  {
    title: '我的档案',
    items: [
      { path: '/learning-report', label: '学习报告', icon: 'chart' },
      { path: '/learning-hours', label: '我的学时', icon: 'clock' },
      { path: '/my-certificates', label: '我的证书', icon: 'cert' },
      { path: '/my/profile', label: '个人中心', icon: 'user' },
      { path: '/notifications', label: '消息通知', icon: 'bell' },
    ],
  },
];

/** AGENCY_ADMIN 专属导航（纯机构管理员，非超管/组织管理员） */
const AGENCY_ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: '工作台',
    items: [
      { path: '/dashboard', label: '工作台', icon: 'dashboard', perm: null },
      { path: '/my/profile', label: '个人中心', icon: 'user', perm: null },
      { path: '/notifications', label: '消息通知', icon: 'bell', perm: 'notification:view' },
    ],
  },
  {
    title: '机构管理',
    items: [
      { path: '/agencies', label: '我的机构', icon: 'building', perm: 'agency:view' },
      { path: '/admin/agency-students', label: '学员管理', icon: 'users', perm: 'agency:view:students' },
      { path: '/agencies/radar', label: '招生雷达', icon: 'chart', perm: 'agency:view' },
      { path: '/admin/learning-hours', label: '学时管理', icon: 'timer', perm: 'learningHour:manage' },
      { path: '/admin/learning-hour-types', label: '学时类型', icon: 'layers', perm: 'learningHour:manage' },
    ],
  },
];

export default function Sidebar({ user, forceExpanded = false }: { user: any; forceExpanded?: boolean }) {
  const pathname = usePathname();
  const settings = useSiteSettings();
  const router = useRouter();
  const [allowOrgOwnBank, setAllowOrgOwnBank] = useState<boolean | null>(null);
  const { theme, setTheme } = useTheme();
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
  // 移动端抽屉强制展开（不受桌面端折叠偏好影响）
  const effCollapsed = forceExpanded ? false : collapsed;

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
    <aside className={`${effCollapsed ? 'w-[64px]' : 'w-[240px]'} flex-shrink-0 flex flex-col h-dvh-fb sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-200`}>
      {/* Logo */}
      <div className={`${effCollapsed ? 'px-3' : 'px-5'} py-6 border-b border-[var(--sidebar-border)]`}>
        <div className="flex items-center gap-3">
          <FoxLogo size={effCollapsed ? 30 : 36} />
          {!effCollapsed && (
            <div className="font-serif font-bold leading-tight tracking-wider text-[var(--sidebar-brand-text)]">
              {settings?.siteName || 'FoxLearn'}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleGroups.map(group => (
          <div key={group.title}>
            {!isStudent && !effCollapsed && (
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--sidebar-group)]">
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
                <Link key={item.path + item.label} href={item.path} title={effCollapsed ? item.label : undefined}
                  className={`flex items-center ${effCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-lg cursor-pointer text-sm transition-all no-underline ${
                    isActive
                      ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-text)]'
                  }`}>
                  <span className="flex-shrink-0">{(() => { const Icon = ICON_MAP[item.icon] || ClipboardList; return <Icon size={18} className="opacity-80" />; })()}</span>
                  {!effCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {isActive && !effCollapsed && (
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

        {!forceExpanded && (

        <button onClick={toggleCollapsed}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md text-[11px] text-[var(--sidebar-group)] hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-hover-bg)] transition-colors bg-transparent border-none cursor-pointer">
          {effCollapsed ? '»' : '« 收起'}
        </button>

        )}
      </div>
      {/* Theme switcher */}
      {!effCollapsed && (
        <div className="px-4 py-1.5 border-t border-[var(--sidebar-border)]">
          <button
            onClick={() => { const ids = THEMES.map(t=>t.id); const next = ids[(ids.indexOf(theme)+1)%ids.length]; setTheme(next); }}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-[11px] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] transition-colors bg-transparent border-none cursor-pointer"
            title="切换皮肤风格">
            <span style={{fontSize:13}}>🎨</span>
            <span className="flex-1 text-left">{THEMES.find(t=>t.id===theme)?.label || '主题'}</span>
            <span style={{opacity:0.5,fontSize:10}}>切换</span>
          </button>
        </div>
      )}
      {/* User info + logout */}
      <div className={`${effCollapsed ? 'px-2' : 'px-5'} py-4 border-t border-[rgba(196,188,176,0.08)]`}>
        <div className={`flex items-center ${effCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 bg-[var(--fox-glow-strong)] text-[var(--fox-light)]">
            {user?.displayName?.[0] || '🦊'}
          </div>
          {!effCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--sidebar-text)] truncate">{user?.displayName || ''}</div>
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
