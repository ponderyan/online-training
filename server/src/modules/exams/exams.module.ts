import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExamsController } from './exams.controller.js';
import { StudentExamController } from './student-exam.controller.js';
import { GradingController } from './grading.controller.js';
import { TranscriptController } from './transcript.controller.js';
import { ScoreAppealController } from './score-appeal.controller.js';
import { ExamAnalysisController } from './exam-analysis.controller.js';
import { ProctoringController } from './proctoring.controller.js';
import { ExamsService } from './exams.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { ScoreAppealService } from './score-appeal.service.js';
import { ExamAnalysisService } from './exam-analysis.service.js';
import { ProctoringService } from './proctoring.service.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';

@Module({
  imports: [PrismaModule, SystemConfigModule],
  controllers: [ExamsController, StudentExamController, GradingController, TranscriptController, ScoreAppealController, ExamAnalysisController, ProctoringController],
  providers: [ExamsService, CertificatesService, ScoreAppealService, ExamAnalysisService, ProctoringService],
  exports: [ExamsService],
})
export class ExamsModule {}
