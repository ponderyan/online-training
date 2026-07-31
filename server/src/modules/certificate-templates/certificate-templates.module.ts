import { Global, Module } from '@nestjs/common';
import { CertificateTemplatesController } from './certificate-templates.controller.js';
import { CertificateTemplatesService } from './certificate-templates.service.js';

@Global()
@Module({
  controllers: [CertificateTemplatesController],
  providers: [CertificateTemplatesService],
  exports: [CertificateTemplatesService],
})
export class CertificateTemplatesModule {}
