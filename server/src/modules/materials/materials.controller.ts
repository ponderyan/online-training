import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from './materials.service.js';

@Controller('api/materials')
export class MaterialsController {
  constructor(private service: MaterialsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/stats')
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStats(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { subjectId: string; name?: string; batchNote?: string; createdBy: string },
  ) {
    return this.service.upload(file, body);
  }

  @Put('questions/:id/review')
  reviewQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      reviewStatus: 'APPROVED' | 'REJECTED' | 'EDITED';
      reviewNote?: string;
      content?: string;
      options?: any;
      blanks?: any;
      answer?: string;
      explanation?: string;
      difficulty?: string;
      suggestedGroup?: string;
    },
  ) {
    return this.service.reviewQuestion(id, data);
  }

  @Post(':id/batch-review')
  batchReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: 'approve' | 'reject'; questionIds?: number[] },
  ) {
    return this.service.batchReview(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
