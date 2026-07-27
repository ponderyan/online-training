import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, UseInterceptors, UploadedFile, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeDocumentsService } from './knowledge-documents.service.js';
import { ChunkAiService } from './chunk-ai.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(
    private service: KnowledgeService,
    private docsService: KnowledgeDocumentsService,
    private chunkAi: ChunkAiService,
  ) {}

  // ─── 文档管理 ───

  @Get('documents')
  @RequirePermission(P.SYSTEM_CONFIG)
  async listDocuments(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.docsService.listDocuments({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
      subjectId: subjectId ? parseInt(subjectId) : undefined,
    });
  }

  @Get('documents/:id')
  @RequirePermission(P.SYSTEM_CONFIG)
  async getDocument(@Param('id', ParseIntPipe) id: number) {
    return this.docsService.getDocument(id);
  }

  @Post('upload')
  @RequirePermission(P.SYSTEM_CONFIG)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!['.pdf', '.txt', '.md', '.docx'].includes(ext)) {
        cb(new BadRequestException('仅支持 PDF / TXT / MD / DOCX 格式'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { subjectId: string; name?: string },
    @Req() req: any,
  ) {
    return this.docsService.upload(file, { ...body, createdBy: String(req.user.id) });
  }

  @Delete('documents/:id')
  @RequirePermission(P.SYSTEM_CONFIG)
  async deleteDocument(@Param('id', ParseIntPipe) id: number) {
    return this.docsService.deleteDocument(id);
  }

  // 兼容旧接口：按 source 删除
  @Delete('by-source/:source')
  @RequirePermission(P.SYSTEM_CONFIG)
  async deleteBySource(@Param('source') source: string) {
    return this.service.deleteBySource(decodeURIComponent(source));
  }

  // ─── 分块管理 ───

  @Get('documents/:id/chunks')
  @RequirePermission(P.SYSTEM_CONFIG)
  async getChunks(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.docsService.getChunks(id, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  @Put('chunks/:id')
  @RequirePermission(P.SYSTEM_CONFIG)
  async updateChunk(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { content?: string; title?: string },
  ) {
    return this.docsService.updateChunk(id, data);
  }

  @Post('chunks/:id/merge')
  @RequirePermission(P.SYSTEM_CONFIG)
  async mergeChunk(@Param('id', ParseIntPipe) id: number) {
    return this.docsService.mergeChunks(id);
  }

  @Post('chunks/:id/split')
  @RequirePermission(P.SYSTEM_CONFIG)
  async splitChunk(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { position: number },
  ) {
    return this.docsService.splitChunk(id, data);
  }

  @Delete('chunks/:id')
  @RequirePermission(P.SYSTEM_CONFIG)
  async deleteChunk(@Param('id', ParseIntPipe) id: number) {
    return this.docsService.deleteChunk(id);
  }

  @Post('documents/:id/rebuild')
  @RequirePermission(P.SYSTEM_CONFIG)
  async rebuildChunks(
    @Param('id', ParseIntPipe) id: number,
    @Body() data?: { chunkSize?: number; overlap?: number },
  ) {
    return this.docsService.rebuildChunks(id, data);
  }

  // ─── 知识块 ↔ 知识点 ───

  @Put('chunks/:id/knowledge-points')
  @RequirePermission(P.SYSTEM_CONFIG)
  async setChunkKnowledgePoints(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { knowledgePointIds: number[] },
  ) {
    return this.docsService.setChunkKnowledgePoints(id, data.knowledgePointIds || []);
  }

  // ─── 检索测试 ───

  @Post('test-query')
  @RequirePermission(P.SYSTEM_CONFIG)
  async testQuery(@Body() data: { query: string; subjectId?: number; limit?: number }) {
    if (!data.query?.trim()) throw new BadRequestException('请输入检索内容');
    return this.docsService.testQuery(data.query, data.subjectId, data.limit || 10);
  }

  // ─── AI 功能 ───

  @Post('documents/:id/auto-label')
  @RequirePermission(P.SYSTEM_CONFIG)
  async autoLabel(@Param('id', ParseIntPipe) id: number) {
    return this.chunkAi.autoLabelChunks(id);
  }

  @Post('chunks/:id/generate-questions')
  @RequirePermission(P.SYSTEM_CONFIG)
  async generateQuestions(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { questionType?: string; count?: number; knowledgePointIds?: number[] },
  ) {
    return this.chunkAi.generateQuestionsFromChunk(id, data);
  }

  @Post('documents/:id/generate-qa')
  @RequirePermission(P.SYSTEM_CONFIG)
  async generateQa(@Param('id', ParseIntPipe) id: number) {
    return this.chunkAi.generateQaPairsForDocument(id);
  }

  @Post('chunks/:id/generate-qa')
  @RequirePermission(P.SYSTEM_CONFIG)
  async generateChunkQa(@Param('id', ParseIntPipe) id: number) {
    return this.chunkAi.generateQaPairs(id);
  }

  // ─── 兼容旧接口 ───

  @Post('query')
  async queryPlaceholder() {
    return { success: true, message: 'AI 知识库问答功能开发中，敬请期待' };
  }
}
