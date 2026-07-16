import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExamsController } from './exams.controller.js';
import { StudentExamController } from './student-exam.controller.js';
import { StudentLearningController } from './student-learning.controller.js';
import { GradingController } from './grading.controller.js';
import { TranscriptController } from './transcript.controller.js';
import { ScoreAppealController } from './score-appeal.controller.js';
import { ExamAnalysisController } from './exam-analysis.controller.js';
import { ProctoringController } from './proctoring.controller.js';
import { ExamsService } from './exams.service.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { ScoreAppealService } from './score-appeal.service.js';
import { ExamAnalysisService } from './exam-analysis.service.js';
import { LearningReportService } from './learning-report.service.js';
import { ProctoringService } from './proctoring.service.js';
import { PublishSchedulerService } from './publish-scheduler.service.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';

@Module({
  imports: [PrismaModule, SystemConfigModule, ScheduleModule.forRoot()],
  controllers: [ExamsController, StudentExamController, StudentLearningController, GradingController, TranscriptController, ScoreAppealController, ExamAnalysisController, ProctoringController],
  providers: [ExamsService, CertificatesService, ScoreAppealService, ExamAnalysisService, LearningReportService, ProctoringService, PublishSchedulerService],
  exports: [ExamsService],
})
export class ExamsModule {}
