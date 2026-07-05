/**
 * 证书防伪签名工具
 *
 * 用于结业证书 QR 码内容的 HMAC-SHA256 签名
 * 验证 API 验签，防止伪造 QR 码
 *
 * 旧证书无 sig 参数时跳过验签，向后兼容
 */

import * as crypto from 'crypto';

// 服务端签名密钥（生产环境从环境变量读取）
const SIGN_KEY = process.env.CERT_SIGN_KEY || 'foxlearn-dev-sign-key-2026';

/**
 * 对证书 QR 码内容进行 HMAC-SHA256 签名
 * @returns 16 字符十六进制签名
 */
export function signCertificateQrData(certificateNo: string, verificationCode: string): string {
  const payload = `${certificateNo}|${verificationCode}`;
  return crypto.createHmac('sha256', SIGN_KEY).update(payload).digest('hex').slice(0, 16);
}

/**
 * 验签
 * 使用 timingSafeEqual 防止时序攻击
 */
export function verifyCertificateQrData(
  certificateNo: string,
  verificationCode: string,
  signature: string,
): boolean {
  try {
    const expected = signCertificateQrData(certificateNo, verificationCode);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
