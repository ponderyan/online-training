import { Controller, Get, Post, Body, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service.js';
import { CaptchaService } from './captcha.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private captchaService: CaptchaService,
  ) {}

  @Public()
  @Get('captcha')
  captcha(@Res() res: Response) {
    const { id, svg } = this.captchaService.generate();
    res.json({ id, svg });
  }

  @Public()
  @Post('register')
  @HttpCode(200)
  register(@Body() data: { username: string; displayName: string; password: string; phone?: string; email?: string }) {
    return this.authService.register(data);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() data: { username: string; password: string; captchaId?: string; captchaAnswer?: string }) {
    if (data.captchaId && data.captchaAnswer !== undefined) {
      if (!this.captchaService.validate(data.captchaId, data.captchaAnswer)) {
        return { error: '验证码错误', captchaRequired: true };
      }
    }
    return this.authService.login(data.username, data.password);
  }
}
