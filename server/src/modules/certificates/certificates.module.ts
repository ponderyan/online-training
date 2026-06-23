import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CertificatesController } from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
