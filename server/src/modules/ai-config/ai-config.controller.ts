import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { AiConfigService } from './ai-config.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/ai-configs')
export class AiConfigController {
  constructor(private service: AiConfigService) {}

  @Get() @RequirePermission(Permissions.SYSTEM_CONFIG) findAll() { return this.service.findAll(); }
  @Post() @RequirePermission(Permissions.SYSTEM_CONFIG) create(@Body() data: any) { return this.service.create(data); }
  @Put(':id') @RequirePermission(Permissions.SYSTEM_CONFIG) update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }
  @Delete(':id') @RequirePermission(Permissions.SYSTEM_CONFIG) remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Post('test')
  @RequirePermission(Permissions.SYSTEM_CONFIG)
  async testConnection(@Body() data: { apiBaseUrl: string; apiKey: string; modelVersion: string; configId?: number }) {
    let realKey = data.apiKey;
    if (data.apiKey.includes('****') && data.configId) {
      const config = await this.service.findById(data.configId);
      if (config) realKey = config.apiKey;
    }
    return this.service.testConnection({ ...data, apiKey: realKey });
  }
}
