import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException, Req, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { OrganizationsService } from './organizations.service.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { Permissions as P } from '../../common/permissions.constants.js';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  // ── 字面量路由必须声明在 :id 之前，避免被 :id 捕获 ──

  @Get()
  @RequirePermission(P.ORG_VIEW)
  findAll() { return this.service.findAll(); }

  @Get('tree')
  @RequirePermission(P.ORG_VIEW)
  getTree() { return this.service.getTree(); }

  @Get(':id')
  @RequirePermission(P.ORG_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Get(':id/data-scope')
  @RequirePermission(P.ORG_VIEW)
  getDataScope(@Param('id', ParseIntPipe) id: number) { return this.service.getDataScope(id); }

  @Get(':id/users')
  @RequirePermission(P.ORG_VIEW)
  getOrgUsers(@Param('id', ParseIntPipe) id: number) { return this.service.getOrgUsers(id); }

  @Post()
  @RequirePermission(P.ORG_CREATE)
  create(@Body() data: {
    name: string; code: string; parentId?: number | null;
    contactName?: string; contactPhone?: string; contactEmail?: string;
    orgType?: string;
  }) {
    return this.service.create(data);
  }

  @Post('import')
  @RequirePermission(P.ORG_CREATE)
  importOrganizations(@Body() data: { rows: { name: string; parentName?: string; sortOrder?: number }[] }) {
    return this.service.importOrganizations(data.rows || []);
  }

  @Put(':id')
  @RequirePermission(P.ORG_EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: {
    name?: string; contactName?: string; contactPhone?: string; contactEmail?: string;
    isActive?: boolean; sortOrder?: number; orgType?: string;
  }) {
    return this.service.update(id, data);
  }

  @Put(':id/move')
  @RequirePermission(P.ORG_EDIT)
  move(@Param('id', ParseIntPipe) id: number, @Body() data: { newParentId: number | null }) {
    return this.service.move(id, data.newParentId);
  }

  @Delete(':id')
  @RequirePermission(P.ORG_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Post(':id/migrate-students')
  @RequirePermission(P.ORG_EDIT)
  migrateStudents(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { targetOrgId: number; moveHours?: boolean; moveExams?: boolean },
  ) {
    return this.service.migrateStudents(id, data.targetOrgId, { moveHours: data.moveHours, moveExams: data.moveExams });
  }

  /** 证书图片上传（logo / 印章） */
  @Post(':id/cert-upload')
  @RequirePermission(P.ORG_EDIT)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
        cb(new BadRequestException('仅支持 PNG / JPG / SVG / WebP 格式'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async uploadCertImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { type: string },
    @Req() req: any,
  ) {
    // 机构隔离：非 SUPER_ADMIN 只能操作自己所属机构
    const userRoles: string[] = req.user?.roles || [];
    const userOrgId = req.user?.orgId;
    if (userOrgId && !userRoles.includes('SUPER_ADMIN') && userOrgId !== id) {
      throw new ForbiddenException('无权操作其他机构的证书配置');
    }
    return this.service.saveCertImage(id, file, body.type);
  }

  /** 证书配置：签发单位、logo、印章、底部文字 */
  @Put(':id/cert-config')
  @RequirePermission(P.ORG_EDIT)
  updateCertConfig(@Param('id', ParseIntPipe) id: number, @Body() data: {
    certIssuerName?: string; certLogoUrl?: string; certFooterText?: string;
    sealUrl?: string; useFoxLearnSeal?: boolean;
  }, @Req() req?: any) {
    // 机构隔离：非 SUPER_ADMIN 只能操作自己所属机构
    const userRoles: string[] = req?.user?.roles || [];
    const userOrgId = req?.user?.orgId;
    if (userOrgId && !userRoles.includes('SUPER_ADMIN') && userOrgId !== id) {
      throw new ForbiddenException('无权操作其他机构的证书配置');
    }
    return this.service.updateCertConfig(id, data);
  }
}
