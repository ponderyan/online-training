import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsService } from './audit-logs.service.js';
import { AuditCronService } from './audit-cron.service.js';

@Module({ imports: [PrismaModule, SystemConfigModule], controllers: [AuditLogsController], providers: [AuditLogsService, AuditCronService] })
export class AuditLogsModule {}
