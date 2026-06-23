import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnrollmentAgenciesController } from './enrollment-agencies.controller.js';
import { EnrollmentAgenciesService } from './enrollment-agencies.service.js';

@Module({ imports: [PrismaModule], controllers: [EnrollmentAgenciesController], providers: [EnrollmentAgenciesService] })
export class EnrollmentAgenciesModule {}
