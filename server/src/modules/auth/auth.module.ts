import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { UserProfileController } from './user-profile.controller.js';
import { AuthService } from './auth.service.js';
import { CaptchaService } from './captcha.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const JWT_SECRET = process.env.JWT_SECRET || 'foxlearn-dev-secret-key-2026';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    PrismaModule,
  ],
  controllers: [AuthController, UserProfileController],
  providers: [AuthService, CaptchaService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, CaptchaService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
