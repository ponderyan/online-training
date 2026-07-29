import { Module } from '@nestjs/common';
import { OrgCodesController } from './org-codes.controller.js';
import { OrgCodesService } from './org-codes.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';

@Module({
  imports: [PrismaModule, SystemConfigModule],
  controllers: [OrgCodesController],
  providers: [OrgCodesService],
  exports: [OrgCodesService],
})
export class OrgCodesModule {}
