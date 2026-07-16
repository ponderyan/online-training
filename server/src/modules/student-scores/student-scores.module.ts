import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StudentScoresController } from './student-scores.controller.js';
import { StudentScoresService } from './student-scores.service.js';

@Module({ imports: [PrismaModule], controllers: [StudentScoresController], providers: [StudentScoresService] })
export class StudentScoresModule {}
