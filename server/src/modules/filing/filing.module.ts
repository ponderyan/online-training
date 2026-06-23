import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FilingController } from './filing.controller.js';
import { FilingService } from './filing.service.js';

@Module({ imports: [PrismaModule], controllers: [FilingController], providers: [FilingService] })
export class FilingModule {}
