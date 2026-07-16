'use client';

/**
 * 结业证书 — 屏幕预览模板
 * 视觉与后端 server/.../templates/certificate.html 保持一致（PDF 下载同款）
 * 使用暖色 theme token + serif 字体，模拟纸质证书质感
 */

export interface CompletionCertificateData {
  studentName: string;
  courseName: string;
  certificateNo: string;
  issueDate: string; // ISO 或 yyyy-mm-dd
  verificationCode: string;
  qrDataUrl?: string; // 真实 QR data URL（后端生成），为空时显示占位
}

function formatDate(d: string): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

export default function CompletionCertificate({ data }: { data: CompletionCertificateData }) {
  return (
    <div className="cert-paper cert-completion">
      {/* 四角装饰 */}
      <span className="cert-corner cert-corner-tl" />
      <span className="cert-corner cert-corner-tr" />
      <span className="cert-corner cert-corner-bl" />
      <span className="cert-corner cert-corner-br" />

      {/* 头部 */}
      <div className="cert-header">
        <div className="cert-logo">🦊 FoxLearn 狐学</div>
        <div className="cert-title">结业证书</div>
        <div className="cert-subtitle">CERTIFICATE OF COMPLETION</div>
      </div>

      {/* 正文 */}
      <div className="cert-body">
        兹证明
        <div className="cert-name">{data.studentName || '—'}</div>
        参加培训课程 <span className="cert-course">{data.courseName || '—'}</span>
        <div className="cert-conclusion">经考核成绩合格，准予结业，特发此证。</div>
      </div>

      {/* 底部信息 */}
      <div className="cert-footer">
        <div className="cert-meta">
          <div>证书编号：<span className="cert-no">{data.certificateNo || '—'}</span></div>
          <div>颁发日期：{formatDate(data.issueDate)}</div>
          <div>防伪验证码：<span className="cert-code">{(data.verificationCode || '').slice(0, 8).toUpperCase() || '—'}</span></div>
        </div>
        <div className="cert-qr-block">
          {data.qrDataUrl ? (
            <img src={data.qrDataUrl} width="96" height="96" alt="QR Code" className="cert-qr-img" />
          ) : (
            <div className="cert-qr-placeholder" aria-hidden>
              <span>扫码查验</span>
            </div>
          )}
          <div className="cert-qr-text">
            扫码查验真伪<br />
            <strong>FoxLearn</strong> 证书验证
          </div>
        </div>
      </div>

      <div className="cert-verify-line">本证书最终解释权归 FoxLearn 狐学所有 · 扫描二维码可在线验证</div>
    </div>
  );
}
