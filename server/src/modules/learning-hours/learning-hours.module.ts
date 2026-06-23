import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LearningHoursController } from './learning-hours.controller.js';
import { LearningHoursService } from './learning-hours.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LearningHoursController],
  providers: [LearningHoursService],
  exports: [LearningHoursService],
})
export class LearningHoursModule {}
