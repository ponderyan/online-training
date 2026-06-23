import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { VideoCoursesController } from './video-courses.controller.js';
import { VideoCoursesService } from './video-courses.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [VideoCoursesController],
  providers: [VideoCoursesService],
})
export class VideoCoursesModule {}
