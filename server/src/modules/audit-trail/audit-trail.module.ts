import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditTrailController } from './audit-trail.controller.js';
import { AuditTrailService } from './audit-trail.service.js';

@Module({ imports: [PrismaModule], controllers: [AuditTrailController], providers: [AuditTrailService] })
export class AuditTrailModule {}
