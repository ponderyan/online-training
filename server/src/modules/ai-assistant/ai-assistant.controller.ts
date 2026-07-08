import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/ai')
export class AiAssistantController {
  constructor(private service: AiAssistantService) {}

  @Post('ask')
  @UseGuards(JwtAuthGuard)
  async ask(@Body() body: { question: string }, @Req() req: any): Promise<any> {
    return this.service.ask(body.question, req.user?.id || req.user?.sub || 0);
  }
}
