import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class AttachmentsService {
  private uploadDir = path.resolve('uploads/attachments');

  constructor(private prisma: PrismaService) {
    fs.mkdir(this.uploadDir, { recursive: true }).catch(() => {});
  }

  async upload(userId: number, file: Express.Multer.File, category: string, description?: string) {
    const savedName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, savedName);
    await fs.writeFile(filePath, file.buffer);

    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        category,
        fileName: file.originalname,
        filePath: savedName,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: description || null,
      },
    });

    // 如果是头像上传，自动回写 User.avatar 并清理旧头像
    if (category === 'AVATAR') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
      // 删除旧头像文件
      if (user?.avatar) {
        const oldPath = path.join(this.uploadDir, user.avatar.replace('/uploads/attachments/', ''));
        try { await fs.unlink(oldPath); } catch {}
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: `/uploads/attachments/${savedName}` },
      });
    }

    return attachment;
  }

  async findByUser(userId: number, category?: string) {
    const where: any = { userId };
    if (category) where.category = category;
    return this.prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('附件不存在');
    return att;
  }

  async delete(id: number) {
    const att = await this.findOne(id);
    try { await fs.unlink(path.join(this.uploadDir, att.filePath)); } catch {}
    return this.prisma.attachment.delete({ where: { id } });
  }

  async verify(id: number, verifiedBy: number) {
    return this.prisma.attachment.update({
      where: { id },
      data: { isVerified: true, verifiedBy, verifiedAt: new Date() },
    });
  }

  getFilePath(att: any): string {
    return path.join(this.uploadDir, att.filePath);
  }
}
