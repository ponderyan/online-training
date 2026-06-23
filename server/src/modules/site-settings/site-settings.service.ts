import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULTS = {
  siteName: 'FoxLearn',
  siteTitle: 'FoxLearn · 狐学',
  footerText: '跟着小狐狸，知识不迷路 🐾',
  publicRegistration: false,
};

@Injectable()
export class SiteSettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.siteSetting.findFirst();
    if (!settings) return DEFAULTS;
    return {
      siteName: settings.siteName || DEFAULTS.siteName,
      siteTitle: settings.siteTitle || DEFAULTS.siteTitle,
      siteLogo: settings.siteLogo,
      favicon: settings.favicon,
      footerText: settings.footerText || DEFAULTS.footerText,
      icpBeian: settings.icpBeian,
      publicRegistration: settings.publicRegistration ?? DEFAULTS.publicRegistration,
    };
  }

  async update(data: {
    siteName?: string; siteTitle?: string; siteLogo?: string;
    favicon?: string; footerText?: string; icpBeian?: string;
    publicRegistration?: boolean;
  }) {
    const existing = await this.prisma.siteSetting.findFirst();
    if (existing) {
      return this.prisma.siteSetting.update({ where: { id: existing.id }, data });
    }
    return this.prisma.siteSetting.create({ data: data as any });
  }
}
