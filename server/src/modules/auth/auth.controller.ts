import { Controller, Get, Post, Body, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service.js';
import { CaptchaService } from './captcha.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Throttle } from '@nestjs/throttler';

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
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.REGISTER_THROTTLE_LIMIT ?? 10) } })
  @Post('register')
  @HttpCode(200)
  register(@Body() data: { username: string; displayName: string; password: string; phone?: string; email?: string }) {
    return this.authService.register(data);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.REFRESH_THROTTLE_LIMIT ?? 60) } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() data: { refreshToken: string }) {
    return this.authService.refresh(data.refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.LOGIN_THROTTLE_LIMIT ?? 5) } })
  @Post('login')
  @HttpCode(200)
  login(@Body() data: { username: string; password: string; captchaId?: string; captchaAnswer?: string }) {
    // ★ 2026-08-13 验证码先于密码校验（默认强制，LOGIN_REQUIRE_CAPTCHA=false 可关——本地测试脚本用）：
    //   验证码缺失/错误一律先拦截，不进入 authService.login → 不触发密码失败计数与锁定。
    //   此前验证码是「可选」——客户端不传 captchaId/captchaAnswer 即绕过验证码直接测密码（failedLoginCount 照常累加），洞已堵。
    const requireCaptcha = process.env.LOGIN_REQUIRE_CAPTCHA !== 'false';
    if (requireCaptcha && (!data.captchaId || !data.captchaAnswer)) {
      return { error: '请输入验证码', captchaRequired: true };
    }
    if (data.captchaId && data.captchaAnswer !== undefined) {
      if (!this.captchaService.validate(data.captchaId, data.captchaAnswer)) {
        return { error: '验证码错误', captchaRequired: true };
      }
    }
    return this.authService.login(data.username, data.password);
  }
}
