import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrainingProgramsController } from './training-programs.controller.js';
import { TrainingProgramsService } from './training-programs.service.js';
import { BatchesService } from './batches.service.js';
import { SchedulesService } from '../courses/schedules.service.js';
import { EvidenceService } from './evidence.service.js';
import { AttendanceService } from './attendance.service.js';

@Module({ imports: [PrismaModule], controllers: [TrainingProgramsController], providers: [TrainingProgramsService, BatchesService, SchedulesService, EvidenceService, AttendanceService] })
export class TrainingProgramsModule {}
