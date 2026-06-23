import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CoursesController, SchedulesController],
  providers: [CoursesService, SchedulesService],
})
export class CoursesModule {}
