import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
