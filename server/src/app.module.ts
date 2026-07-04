import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ExamsModule } from './modules/exams/exams.module.js';
import { SubjectsModule } from './modules/subjects/subjects.module.js';
import { ChaptersModule } from './modules/chapters/chapters.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { PapersModule } from './modules/papers/papers.module.js';
import { AiConfigModule } from './modules/ai-config/ai-config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DataDictionaryModule } from './modules/data-dictionary/data-dictionary.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { TrainingProgramsModule } from './modules/training-programs/training-programs.module.js';
import { EnrollmentAgenciesModule } from './modules/enrollment-agencies/enrollment-agencies.module.js';
import { GradingModule } from './modules/grading/grading.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { InstructorsModule } from './modules/instructors/instructors.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EvaluationsModule } from './modules/evaluations/evaluations.module.js';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module.js';
import { DataImportExportModule } from './modules/data-import-export/data-import-export.module.js';
import { FilingModule } from './modules/filing/filing.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { CourseVideosModule } from './modules/course-videos/course-videos.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { VideoCoursesModule } from './modules/video-courses/video-courses.module.js';
import { LearningHoursModule } from './modules/learning-hours/learning-hours.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SystemConfigModule } from './modules/system-config/system-config.module.js';
import { KnowledgePointsModule } from './modules/knowledge-points/knowledge-points.module.js';
import { PermissionGuard } from './common/guards/permission.guard.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SubjectsModule,
    ChaptersModule,
    DataDictionaryModule,
    TagsModule,
    QuestionsModule,
    TemplatesModule,
    PapersModule,
    AiConfigModule,
    MaterialsModule,
    StudentsModule,
    ExamsModule,
    CertificatesModule,
    AttachmentsModule,
    TrainingProgramsModule,
    EnrollmentAgenciesModule,
    GradingModule,
    PermissionsModule,
    InstructorsModule,
    CoursesModule,
    DashboardModule,
    EvaluationsModule,
    NotificationsModule,
    AuditLogsModule,
    SiteSettingsModule,
    DataImportExportModule,
    FilingModule,
    CourseVideosModule,
    LearningHoursModule,
    KnowledgeModule,
    VideoCoursesModule,
    OrganizationsModule,
    UsersModule,
    SystemConfigModule,
    KnowledgePointsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
