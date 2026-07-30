import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../modules/prisma/prisma.module.js';
import { ExamAccessService } from './exam-access.service.js';
import { ResourceAccessService } from './resource-access.service.js';

/**
 * 全局模块：提供 ExamAccessService + ResourceAccessService
 * 所有需要校验组织归属的 controller/service 可直接注入。
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [ExamAccessService, ResourceAccessService],
  exports: [ExamAccessService, ResourceAccessService],
})
export class ExamAccessModule {}
