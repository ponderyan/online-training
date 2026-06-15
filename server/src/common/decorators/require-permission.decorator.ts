import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions.constants.js';

export const PERMISSION_KEY = 'required_permission';

/**
 * 标记API需要的权限点
 * 使用示例：@RequirePermission( Permissions.PAPER_DOWNLOAD )
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
