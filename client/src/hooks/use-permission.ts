import { useMemo } from 'react';
import { getUser, getRoles, isStudent, isSuperAdmin, type Role } from '@/lib/roles';

/**
 * 统一权限 hook - 整合 sidebar/can()/app-layout 三处权限逻辑
 */
export function usePermission(user?: any) {
  return useMemo(() => {
    const u = user || getUser();
    const roles = getRoles(u);
    const permissions: string[] = u?.permissions || [];

    // 从 localStorage 缓存中读取（app-layout 加载的）
    let cachedPermissions: string[] = [];
    try {
      const cached = localStorage.getItem('userPermissions');
      if (cached) {
        const parsed = JSON.parse(cached);
        cachedPermissions = parsed.permissions || [];
      }
    } catch {}

    const allPermissions = [...new Set([...permissions, ...cachedPermissions])];

    return {
      user: u,
      roles,
      permissions: allPermissions,
      /** 检查是否拥有指定权限 */
      can: (perm: string) => isSuperAdmin(u) || allPermissions.includes(perm),
      /** 检查是否拥有任一权限 */
      canAny: (perms: string[]) => isSuperAdmin(u) || perms.some(p => allPermissions.includes(p)),
      /** 角色判断 */
      isStudent: isStudent(u),
      isSuperAdmin: isSuperAdmin(u),
      hasRole: (role: Role) => roles.includes(role),
    };
  }, [user]);
}
