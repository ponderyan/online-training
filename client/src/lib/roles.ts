/**
 * 角色工具函数 - 统一角色判断逻辑
 * 消除 sidebar/dashboard/app-layout 中重复的角色判断
 */

export type Role =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'EXAM_OFFICER'
  | 'LECTURER'
  | 'PROCTOR'
  | 'AGENCY_ADMIN'
  | 'AUDITOR'
  | 'STUDENT';

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'EXAM_OFFICER', 'LECTURER', 'PROCTOR', 'AUDITOR', 'AGENCY_ADMIN'];

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function getRoles(user?: any): Role[] {
  const u = user || getUser();
  return u?.roles || (u?.role ? [u.role] : []);
}

export function hasRole(user: any, role: Role): boolean {
  return getRoles(user).includes(role);
}

export function isSuperAdmin(user?: any): boolean {
  return hasRole(user || getUser(), 'SUPER_ADMIN');
}

/**
 * 判断是否为纯学员（只有 STUDENT 角色，没有任何管理角色）
 */
export function isStudent(user?: any): boolean {
  const u = user || getUser();
  const roles = getRoles(u);
  return roles.includes('STUDENT') && !roles.some(r => ADMIN_ROLES.includes(r));
}

export function isExamOfficer(user?: any): boolean {
  return hasRole(user || getUser(), 'EXAM_OFFICER');
}

export function isLecturer(user?: any): boolean {
  return hasRole(user || getUser(), 'LECTURER');
}

export function isProctor(user?: any): boolean {
  return hasRole(user || getUser(), 'PROCTOR');
}

export function isAuditor(user?: any): boolean {
  return hasRole(user || getUser(), 'AUDITOR');
}

export function isAgencyAdmin(user?: any): boolean {
  return hasRole(user || getUser(), 'AGENCY_ADMIN');
}
