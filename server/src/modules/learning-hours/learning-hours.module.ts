import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LearningHoursController } from './learning-hours.controller.js';
import { LearningHourTypesController } from './learning-hour-types.controller.js';
import { LearningHoursService } from './learning-hours.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LearningHoursController, LearningHourTypesController],
  providers: [LearningHoursService],
  exports: [LearningHoursService],
})
export class LearningHoursModule {}
