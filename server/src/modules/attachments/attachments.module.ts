import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
