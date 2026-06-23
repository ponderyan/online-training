import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DataImportExportController } from './data-import-export.controller.js';
import { DataImportExportService } from './data-import-export.service.js';

@Module({ imports: [PrismaModule], controllers: [DataImportExportController], providers: [DataImportExportService] })
export class DataImportExportModule {}
