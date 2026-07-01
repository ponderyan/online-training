import { Controller, Get, Put, Body, Req, ForbiddenException } from '@nestjs/common';
import { SystemConfigService } from './system-config.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/system-config')
export class SystemConfigController {
  constructor(private service: SystemConfigService) {}

  /** 获取题库策略配置 */
  @Get('bank-policy')
  @RequirePermission(Permissions.BANK_POLICY_VIEW)
  async getBankPolicy() {
    const [allow_org_own_bank, org_bank_visibility] = await Promise.all([
      this.service.getBoolean('allow_org_own_bank'),
      this.service.getConfig('org_bank_visibility'),
    ]);
    return {
      allow_org_own_bank,
      org_bank_visibility: org_bank_visibility || 'view_only',
    };
  }

  /** 更新题库策略配置 */
  @Put('bank-policy')
  @RequirePermission(Permissions.BANK_POLICY_MANAGE)
  async updateBankPolicy(
    @Body() data: { allow_org_own_bank?: boolean; org_bank_visibility?: string },
  ) {
    if (data.allow_org_own_bank !== undefined) {
      await this.service.setConfig(
        'allow_org_own_bank',
        String(data.allow_org_own_bank),
        '是否允许机构自建题库',
      );
    }
    if (data.org_bank_visibility) {
      const valid = ['hidden', 'view_only', 'full_access'];
      if (!valid.includes(data.org_bank_visibility)) {
        throw new ForbiddenException('无效的可见性值，可选: hidden/view_only/full_access');
      }
      await this.service.setConfig(
        'org_bank_visibility',
        data.org_bank_visibility,
        '协会对机构题库可见性',
      );
    }
    return this.getBankPolicy();
  }
}
