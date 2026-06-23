import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
