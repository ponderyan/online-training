import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { SubjectsModule } from './modules/subjects/subjects.module.js';
import { ChaptersModule } from './modules/chapters/chapters.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { PapersModule } from './modules/papers/papers.module.js';
import { AiConfigModule } from './modules/ai-config/ai-config.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DataDictionaryModule } from './modules/data-dictionary/data-dictionary.module.js';
import { TagsModule } from './modules/tags/tags.module.js';

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
  ],
})
export class AppModule {}
