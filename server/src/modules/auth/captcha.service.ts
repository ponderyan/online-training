import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';

interface CaptchaEntry {
  text: string;
  expiresAt: number; // 过期时间戳（ms）
}

@Injectable()
export class CaptchaService {
  // 内存存储，生产环境可改为 Redis
  private store = new Map<string, CaptchaEntry>();

  // 每 5 分钟清理过期验证码
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 生成验证码
   * @returns { id, svg } — id 用于后续校验，svg 是图片内容
   */
  generate(): { id: string; svg: string } {
    const captcha = svgCaptcha.createMathExpr({
      mathMin: 1,
      mathMax: 20,
      mathOperator: '+',
      background: '#f6f1e8',
      width: 120,
      height: 44,
      fontSize: 36,
    });

    // 生成唯一 ID（简单但够用）
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    this.store.set(id, {
      text: captcha.text,         // 运算结果，如 "15"
      expiresAt: Date.now() + 5 * 60 * 1000,  // 5 分钟后过期
    });

    return { id, svg: captcha.data };
  }

  /**
   * 校验验证码
   * @returns true 如果验证码正确且未过期
   */
  validate(id: string, answer: string): boolean {
    const entry = this.store.get(id);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(id);
      return false;
    }
    // 去除空格后比较
    const isValid = entry.text.trim() === answer.trim();
    // 无论对错，用完即删（一次性）
    this.store.delete(id);
    return isValid;
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(id);
    }
  }
}
