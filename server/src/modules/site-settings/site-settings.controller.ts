import { Controller, Get, Put, Body } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/site-settings')
export class SiteSettingsController {
  constructor(private service: SiteSettingsService) {}

  /**
   * 品牌配置读取对公开放行：
   * 登录/注册/防伪验证等公共页面与全站 layout 都依赖它展示品牌，
   * 此前挂在 SYSTEM_CONFIG 权限下导致游客 401 只能显示默认品牌。
   * 数据本身非敏感（站点名/logo/页脚/备案号），写操作仍受 SYSTEM_CONFIG 保护。
   */
  @Get()
  @Public()
  async get() {
    return this.service.get();
  }

  @Put()
  @RequirePermission(Permissions.SYSTEM_CONFIG)
  async update(@Body() data: any) {
    return this.service.update(data);
  }
}
