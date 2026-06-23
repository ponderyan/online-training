import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GradingAssignmentController } from './grading-assignment.controller.js';
import { ReviewController } from './review.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [GradingAssignmentController, ReviewController],
})
export class GradingModule {}
