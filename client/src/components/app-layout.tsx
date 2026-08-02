'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './sidebar';
import ErrorBoundary from './error-boundary';
import NotificationBell from './notification-bell';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { GlobalSearch } from './global-search';

export default function AppLayout({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // 面包屑路径映射
  const BREADCRUMB_MAP: Record<string, string> = {
    '/admin/dashboard': '统计看板', '/dashboard': '工作台',
    '/questions': '题库管理', '/exams': '考试管理', '/courses': '课程管理',
    '/students': '学员管理', '/programs': '培训班管理', '/papers': '试卷管理',
    '/certificates': '证书管理', '/instructors': '讲师管理', '/agencies': '招生机构',
    '/admin/organizations': '组织管理', '/admin/certificate-templates': '证书模板',
    '/admin/learning-hours': '学时管理', '/admin/video-courses': '视频课程',
    '/materials': '教材出题', '/generate': '智能组卷', '/proctoring': '监考中心',
    '/grading': '阅卷中心', '/evaluations': '评价管理', '/notifications': '消息通知',
    '/my/profile': '个人中心', '/admin/audit-trail': '全链审计',
    '/admin/system-config': '配置中心', '/admin/ai-configs': 'AI 配置',
  };
  const currentLabel = BREADCRUMB_MAP[pathname] || pathname.split('/').filter(Boolean).pop() || '首页';

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.replace('/login'); return; }

    const doRender = (userData: any) => {
      setUser(userData);
      setLoading(false);
    };

    let userData = JSON.parse(u);

    // 优先从 userPermissions 缓存读取
    const permsStr = localStorage.getItem('userPermissions');
    if (permsStr) {
      const permsData = JSON.parse(permsStr);
      if (permsData.permissions && permsData.permissions.length > 0) {
        userData.permissions = permsData.permissions;
        userData.isSuperAdmin = !!permsData.isSuperAdmin;
        userData.roleInfo = permsData.roles || [];
        doRender(userData);
        return;
      }
    }

    // 缓存不可用 → 从登录 user 对象获取（login 接口已返回 permissions）
    if (userData.permissions && userData.permissions.length > 0) {
      doRender(userData);
      return;
    }

    // 都没有 → 从 API 获取（异步加载完成再渲染）
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(permData => {
        if (permData && permData.permissions) {
          localStorage.setItem('userPermissions', JSON.stringify(permData));
          userData.permissions = permData.permissions || [];
          userData.isSuperAdmin = permData.isSuperAdmin || false;
          userData.roleInfo = permData.roles || [];
        }
        doRender(userData);
      }).catch(() => doRender(userData));
    } else {
      doRender(userData);
    }
  }, [router]);

  // 监听 401 鉴权失效事件（由 lib/api.ts 的 redirectToLogin 派发）
  useEffect(() => {
    const handler = () => router.replace('/login');
    window.addEventListener('auth:redirect-login', handler);
    return () => window.removeEventListener('auth:redirect-login', handler);
  }, [router]);

  if (loading) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top header bar */}
        <header className="flex items-center justify-between px-6 py-2.5" style={{
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid var(--topbar-border)',
          minHeight: 48,
        }}>
          {/* 面包屑 */}
          <nav className="flex items-center gap-1.5 text-xs text-[var(--ink-400)]">
            <span className="text-[var(--ink-300)]">FoxLearn</span>
            <ChevronRight size={12} />
            <span className="text-[var(--ink-700)] font-medium">{currentLabel}</span>
          </nav>

          {/* 右侧：搜索 + 通知 */}
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <NotificationBell user={user} />
          </div>
        </header>
        {/* Main content */}
        {fullBleed ? (
          <main className="flex-1 min-h-0 relative overflow-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        ) : (
          <main className="main-content flex-1 overflow-y-auto min-h-0 p-6 md:p-8 xl:p-10">
            <div className="max-w-7xl mx-auto">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
