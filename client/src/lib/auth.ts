/**
 * 客户端权限检查辅助函数
 * 用法：can('question:create') → true/false
 */

export function can(permission: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const permsStr = localStorage.getItem('userPermissions');
    if (!permsStr) return false;
    const data = JSON.parse(permsStr);
    if (data.isSuperAdmin) return true;
    return data.permissions?.includes(permission) ?? false;
  } catch {
    return false;
  }
}

export function useCan(): (perm: string) => boolean {
  return can;
}
