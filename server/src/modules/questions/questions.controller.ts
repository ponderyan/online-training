import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';
import { QuestionType } from '@prisma/client';

@Controller('api/questions')
export class QuestionsController {
  constructor(private service: QuestionsService) {}

  @Get()
  findAll(
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('isPublic') isPublic?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      chapterId: chapterId ? parseInt(chapterId) : undefined,
      type, difficulty, status, keyword,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Get(':id/referenced-papers')
  getReferencedPapers(@Param('id', ParseIntPipe) id: number) {
    return this.service.getReferencedPapers(id);
  }

  @Post()
  create(@Body() data: any) { return this.service.create(data); }

  @Post('batch')
  batchCreate(@Body() data: { questions: any[] }) {
    return this.service.batchCreate(data.questions);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) { return this.service.update(id, data); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
