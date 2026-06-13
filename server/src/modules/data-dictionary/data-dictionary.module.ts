import { Module } from '@nestjs/common';
import { DataDictionaryController } from './data-dictionary.controller.js';
import { DataDictionaryService } from './data-dictionary.service.js';

@Module({
  controllers: [DataDictionaryController],
  providers: [DataDictionaryService],
})
export class DataDictionaryModule {}
