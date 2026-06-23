import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InstructorsController } from './instructors.controller.js';
import { InstructorsService } from './instructors.service.js';

@Module({ imports: [PrismaModule], controllers: [InstructorsController], providers: [InstructorsService] })
export class InstructorsModule {}
