import { Controller, Get, Put, Body } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/site-settings')
export class SiteSettingsController {
  constructor(private service: SiteSettingsService) {}

  @Get()
  @RequirePermission(Permissions.SYSTEM_CONFIG)
  async get() {
    return this.service.get();
  }

  @Put()
  @RequirePermission(Permissions.SYSTEM_CONFIG)
  async update(@Body() data: any) {
    return this.service.update(data);
  }
}
