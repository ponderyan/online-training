import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';
import { CertificateTemplatesModule } from '../certificate-templates/certificate-templates.module.js';
import { CertificatesController } from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';

@Module({
  imports: [PrismaModule, SystemConfigModule, CertificateTemplatesModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
