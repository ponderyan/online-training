import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { AiConfigService } from './ai-config.service.js';

@Controller('api/ai-configs')
export class AiConfigController {
  constructor(private service: AiConfigService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Post() create(@Body() data: any) { return this.service.create(data); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Post('test')
  testConnection(@Body() data: { apiBaseUrl: string; apiKey: string; modelVersion: string }) {
    return this.service.testConnection(data);
  }
}
