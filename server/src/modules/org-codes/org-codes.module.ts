import { Module } from '@nestjs/common';
import { OrgCodesController } from './org-codes.controller.js';
import { OrgCodesService } from './org-codes.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrgCodesController],
  providers: [OrgCodesService],
  exports: [OrgCodesService],
})
export class OrgCodesModule {}
