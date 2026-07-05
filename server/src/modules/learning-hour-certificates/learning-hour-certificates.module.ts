import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LearningHourCertificatesController } from './learning-hour-certificates.controller.js';
import { LearningHourCertificatesService } from './learning-hour-certificates.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LearningHourCertificatesController],
  providers: [LearningHourCertificatesService],
  exports: [LearningHourCertificatesService],
})
export class LearningHourCertificatesModule {}
