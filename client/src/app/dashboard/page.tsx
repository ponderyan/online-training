'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import StudentDashboard from './components/student-dashboard';
import GlobalAdminDashboard from './components/admin-dashboard';
import ExamOfficerDashboard from './components/exam-officer-dashboard';
import LecturerDashboard from './components/lecturer-dashboard';
import ProctorDashboard from './components/proctor-dashboard';
import AgencyAdminDashboard from './components/agency-admin-dashboard';
import AuditorDashboard from './components/auditor-dashboard';

/** 管理角色列表（与 roles.ts 保持一致） */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR', 'AGENCY_ADMIN'];

/** 角色 → 工作台标签名 */
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '管理员',
  ORG_ADMIN: '组织管理',
  EXAM_OFFICER: '考务',
  LECTURER: '教学',
  PROCTOR: '监考',
  AGENCY_ADMIN: '机构',
  AUDITOR: '审计',
};

/** 判断是否为纯学员（只有 STUDENT，没有任何管理角色） */
function isPureStudent(roles: string[]): boolean {
  return roles.includes('STUDENT') && !roles.some(r => ADMIN_ROLES.includes(r));
}

/** 获取用户的行政角色列表（排除 STUDENT） */
function getAdminRoles(roles: string[]): string[] {
  return roles.filter(r => ADMIN_ROLES.includes(r));
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>('');
  const [studentExams, setStudentExams] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    let parsed: any = null;
    if (u) {
      parsed = JSON.parse(u);
      setUser(parsed);
    }

    const roles: string[] = parsed?.roles || (parsed?.role ? [parsed.role] : []);
    const pureStudent = isPureStudent(roles);
    const adminRoles = getAdminRoles(roles);

    // 设置默认激活角色
    if (pureStudent) {
      setActiveRole('STUDENT');
    } else {
      // 多角色时默认选第一个管理角色
      setActiveRole(adminRoles[0] || 'STUDENT');
    }

    if (pureStudent) {
      // 纯学员：请求学员数据
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const examsReq = fetch('/api/student/exams', { headers }).then(r => r.json()).catch(() => []);
      const certsReq = fetch('/api/certificates/my', { headers }).then(r => (r.ok ? r.json() : [])).catch(() => []);
      Promise.all([examsReq, certsReq]).then(([data, certs]: any) => {
        const list = Array.isArray(data) ? data : [];
        setStudentExams(list);
        const active = list.filter((e: any) => e.sessionStatus === 'ACTIVE').length;
        const pending = list.filter((e: any) => !e.submittedAt && e.sessionStatus !== 'ACTIVE' && new Date(e.startTime) > new Date()).length;
        const completed = list.filter((e: any) => e.submittedAt).length;
        const certList = Array.isArray(certs) ? certs : [];
        setStudentStats({ active, pending, completed, total: list.length, certificateCount: certList.length });
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      // 管理角色：请求统计数据
      fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()).then((data: any) => {
        setStats(data);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, []);

  const roles: string[] = user?.roles || (user?.role ? [user.role] : []);
  const pureStudent = isPureStudent(roles);
  const adminRoles = getAdminRoles(roles);
  const showRoleSwitcher = adminRoles.length > 1;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  };

  const getSubtitle = () => {
    if (pureStudent) return '🎓 我的学习';
    switch (activeRole) {
      case 'EXAM_OFFICER': return '📋 考务工作台';
      case 'LECTURER': return '📚 教学工作台';
      case 'PROCTOR': return '🎥 监考工作台';
      case 'AGENCY_ADMIN': return '🏢 机构工作台';
      case 'AUDITOR': return '🔍 审计工作台';
      default: return '📊 数据概览';
    }
  };

  const renderDashboard = () => {
    if (pureStudent) {
      return <StudentDashboard user={user} studentExams={studentExams} studentStats={studentStats} loading={loading} />;
    }
    if (!stats && loading) {
      return <div className="text-center py-16 text-[var(--ink-300)]">小狐狸正在加载… 🦊</div>;
    }
    switch (activeRole) {
      case 'EXAM_OFFICER': return <ExamOfficerDashboard stats={stats} loading={loading} />;
      case 'LECTURER': return <LecturerDashboard stats={stats} loading={loading} />;
      case 'PROCTOR': return <ProctorDashboard stats={stats} loading={loading} />;
      case 'AGENCY_ADMIN': return <AgencyAdminDashboard stats={stats} loading={loading} />;
      case 'AUDITOR': return <AuditorDashboard stats={stats} loading={loading} />;
      default: return <GlobalAdminDashboard stats={stats} loading={loading} />;
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="page-title">{greeting()}</h1>
          <span className="text-lg text-[var(--fox)]">{user?.displayName ? `，${user.displayName}` : ''}</span>
        </div>
        <p className="page-subtitle">
          {getSubtitle()} · {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* 多角色切换标签 */}
      {showRoleSwitcher && (
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-[var(--paper-dark)] w-fit">
          {adminRoles.map(r => (
            <button
              key={r}
              onClick={() => setActiveRole(r)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all border-none cursor-pointer ${
                activeRole === r
                  ? 'bg-[var(--fox)] text-white shadow-sm'
                  : 'bg-transparent text-[var(--ink-500)] hover:text-[var(--ink-700)] hover:bg-[var(--paper-bright)]'
              }`}
            >
              {ROLE_LABELS[r] || r}
            </button>
          ))}
        </div>
      )}

      {renderDashboard()}
    </AppLayout>
  );
}
