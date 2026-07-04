import { Controller, Get, Patch, Post, Put, Param, Body, Req } from '@nestjs/common';
import { SystemConfigService } from './system-config.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/system-config')
export class SystemConfigController {
  constructor(private service: SystemConfigService) {}

  /** 获取所有配置（按 group 分组） */
  @Get()
  @RequirePermission(Permissions.SYSTEM_CONFIG_VIEW)
  async getAll() {
    return this.service.getAll();
  }

  /** 获取某分组的配置 */
  @Get(':group')
  @RequirePermission(Permissions.SYSTEM_CONFIG_VIEW)
  async getByGroup(@Param('group') group: string) {
    return this.service.getByGroup(group);
  }

  /** 更新单个配置值 */
  @Patch(':key')
  @RequirePermission(Permissions.SYSTEM_CONFIG_MANAGE)
  async update(
    @Param('key') key: string,
    @Body() data: { value: string },
    @Req() req: any,
  ) {
    const operatorId = req.user?.sub || req.user?.id;
    return this.service.update(key, data.value, operatorId);
  }

  /** 批量同步配置（给 seed 脚本用） */
  @Post('sync')
  @RequirePermission(Permissions.SYSTEM_CONFIG_MANAGE)
  async sync(@Body() data: { configs: any[] }) {
    return this.service.sync(data.configs);
  }

  // ── 向下兼容：原有 bank-policy 路由 ──

  @Get('bank-policy')
  @RequirePermission(Permissions.BANK_POLICY_VIEW)
  async getBankPolicy() {
    const [allow_org_own_bank, org_bank_visibility] = await Promise.all([
      this.service.getBoolean('allow_org_own_bank'),
      this.service.getConfig('org_bank_visibility'),
    ]);
    return { allow_org_own_bank, org_bank_visibility: org_bank_visibility || 'view_only' };
  }

  @Put('bank-policy')
  @RequirePermission(Permissions.BANK_POLICY_MANAGE)
  async updateBankPolicy(@Body() data: { allow_org_own_bank?: boolean; org_bank_visibility?: string }) {
    if (data.allow_org_own_bank !== undefined) {
      await this.service.setConfig('allow_org_own_bank', String(data.allow_org_own_bank));
    }
    if (data.org_bank_visibility) {
      const valid = ['hidden', 'view_only', 'full_access'];
      if (!valid.includes(data.org_bank_visibility)) {
        throw new Error('无效的可见性值');
      }
      await this.service.setConfig('org_bank_visibility', data.org_bank_visibility);
    }
    return this.getBankPolicy();
  }
}
