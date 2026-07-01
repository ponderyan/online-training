import { Module } from '@nestjs/common';
import { PapersController } from './papers.controller.js';
import { PapersService } from './papers.service.js';
import { SystemConfigModule } from '../system-config/system-config.module.js';

@Module({
  imports: [SystemConfigModule],
  controllers: [PapersController],
  providers: [PapersService],
})
export class PapersModule {}
