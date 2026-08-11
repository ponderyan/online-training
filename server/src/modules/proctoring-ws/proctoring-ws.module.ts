import { Module } from '@nestjs/common';
import { ProctoringWsGateway } from './proctoring-ws.gateway.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExamsModule } from '../exams/exams.module.js';
import { ExamAccessModule } from '../../common/services/exam-access.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ExamsModule, ExamAccessModule],
  providers: [ProctoringWsGateway],
})
export class ProctoringWsModule {}
