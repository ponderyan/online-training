'use client';

/**
 * 学时证明 — 屏幕预览模板
 * 视觉与后端 server/.../templates/learning-hour-certificate.html 保持一致（PDF 下载同款）
 */

export interface HoursCertificateData {
  studentName: string;
  idCardMasked?: string;
  programName?: string;
  orgName?: string;
  totalHours: number;
  hoursDetail?: Array<{ typeName?: string; source?: string; hours: number }>;
  startDate?: string | null;
  endDate?: string | null;
  certificateNo: string;
  issueDate?: string | null;
  sealHash?: string | null;
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function HoursCertificate({ data }: { data: HoursCertificateData }) {
  const detail = Array.isArray(data.hoursDetail) ? data.hoursDetail : [];
  return (
    <div className="cert-paper cert-hours">
      {/* 头部 */}
      <div className="cert-header cert-hours-header">
        <div className="cert-logo">🦊 FoxLearn 狐学</div>
        <div className="cert-title">学时证明</div>
        <div className="cert-subtitle">CERTIFICATE OF TRAINING HOURS</div>
      </div>

      {/* 信息网格 */}
      <div className="cert-info-grid">
        <div><span className="cert-label">姓　　名：</span><span className="cert-name-value">{data.studentName || '—'}</span></div>
        <div><span className="cert-label">身份证号：</span><span className="cert-value">{data.idCardMasked || '—'}</span></div>
        <div><span className="cert-label">培训班：</span><span className="cert-value">{data.programName || '—'}</span></div>
        <div><span className="cert-label">所属机构：</span><span className="cert-value">{data.orgName || '—'}</span></div>
        <div className="cert-date-row">学时期间：{formatDate(data.startDate)} 至 {formatDate(data.endDate)}</div>
      </div>

      {/* 学时表 */}
      <table className="cert-hours-table">
        <thead>
          <tr><th>学时类型</th><th style={{ textAlign: 'right' }}>学时（小时）</th></tr>
        </thead>
        <tbody>
          {detail.length > 0 ? detail.map((d, i) => (
            <tr key={i}>
              <td>{d.typeName || d.source || '—'}</td>
              <td className="cert-hours-cell">{d.hours}</td>
            </tr>
          )) : (
            <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--ink-300)' }}>暂无学时明细</td></tr>
          )}
          <tr className="cert-total-row">
            <td><strong>合 计</strong></td>
            <td className="cert-hours-cell">{data.totalHours ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {/* 编号 + 日期 */}
      <div className="cert-hours-meta">
        <span>证书编号：<span className="cert-no">{data.certificateNo || '—'}</span></span>
        <span>发证日期：{formatDate(data.issueDate)}</span>
      </div>

      {/* 印章 + QR */}
      <div className="cert-hours-footer">
        <div className="cert-seal-area">
          <div className="cert-seal-placeholder" aria-hidden>
            <span>印章</span>
          </div>
        </div>
        <div className="cert-qr-block">
          <div className="cert-qr-placeholder" aria-hidden>
            <span>扫码查验</span>
          </div>
          <div className="cert-qr-text">
            扫码查验真伪<br />
            <strong>FoxLearn</strong> 学时验证
          </div>
        </div>
      </div>

      <div className="cert-verify-line">
        验证：foxlearn.cn/verify-hours{data.sealHash ? ` · 防伪指纹：${data.sealHash}` : ''}
      </div>
    </div>
  );
}
