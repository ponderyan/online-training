import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EvaluationsController } from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';

@Module({ imports: [PrismaModule], controllers: [EvaluationsController], providers: [EvaluationsService] })
export class EvaluationsModule {}
