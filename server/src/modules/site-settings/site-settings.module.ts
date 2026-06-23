import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SiteSettingsController } from './site-settings.controller.js';
import { SiteSettingsService } from './site-settings.service.js';

@Module({ imports: [PrismaModule], controllers: [SiteSettingsController], providers: [SiteSettingsService], exports: [SiteSettingsService] })
export class SiteSettingsModule {}
