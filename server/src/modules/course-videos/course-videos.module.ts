import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CourseVideosController } from './course-videos.controller.js';
import { CourseVideosService } from './course-videos.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CourseVideosController],
  providers: [CourseVideosService],
})
export class CourseVideosModule {}
