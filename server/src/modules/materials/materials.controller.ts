import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { MaterialsService } from './materials.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions } from '../../common/permissions.constants.js';

@Controller('api/materials')
export class MaterialsController {
  constructor(private service: MaterialsService) {}

  @Get()
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
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
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/stats')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStats(id);
  }

  @Post()
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  async create(@Body() data: {
    name: string;
    subjectId: number;
    createdBy: number;
    batchNote?: string;
    content?: string;
  }) {
    return this.service.create(data);
  }

  @Post('upload')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (ext !== '.pdf' && ext !== '.pptx') {
        cb(new BadRequestException('仅支持 PDF / PPTX 格式'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { subjectId: string; name?: string; batchNote?: string; createdBy: string },
  ) {
    return this.service.upload(file, body);
  }

  @Put('questions/:id/review')
  @RequirePermission(Permissions.MATERIAL_REVIEW)
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
  @RequirePermission(Permissions.MATERIAL_REVIEW)
  batchReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: 'approve' | 'reject'; questionIds?: number[] },
  ) {
    return this.service.batchReview(id, data);
  }

  @Post(':id/generate')
  @RequirePermission(Permissions.MATERIAL_GENERATE)
  generateQuestions(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateQuestions(id);
  }

  @Delete(':id')
  @RequirePermission(Permissions.MATERIAL_UPLOAD)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
