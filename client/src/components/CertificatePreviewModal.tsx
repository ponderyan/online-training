'use client';

import { useEffect, useState } from 'react';
import CompletionCertificate, { CompletionCertificateData } from './certificate-templates/CompletionCertificate';
import HoursCertificate, { HoursCertificateData } from './certificate-templates/HoursCertificate';
import { useToast } from './Toast';

export type CertificateType = 'completion' | 'hours';

export interface PreviewTarget {
  type: CertificateType;
  /** 结业证书：/certificates/:id/pdf ；学时证明：/learning-hour-certificates/:id/pdf */
  pdfUrl: string;
  /** 渲染数据 */
  completion?: CompletionCertificateData;
  hours?: HoursCertificateData;
  title: string;
}

/**
 * 证书全屏预览 Modal
 * - 居中展示证书 HTML 渲染，带阴影模拟「放在桌上的纸质证书」
 * - 底部：下载 PDF（走后端接口 blob 下载）/ 打印（window.print）/ 关闭
 * - 打印时仅输出证书本身（见 globals.css @media print）
 */
export default function CertificatePreviewModal({
  target, onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  // ESC 关闭 + 锁滚动
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [target, onClose]);

  if (!target) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(target.pdfUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${target.type}-${target.completion?.certificateNo || target.hours?.certificateNo || ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('下载失败：' + e.message);
    }
    setDownloading(false);
  };

  const handlePrint = () => window.print();

  return (
    <div className="cert-preview-overlay screen-only" onClick={onClose}>
      <div className="cert-preview-stage" onClick={e => e.stopPropagation()}>
        {target.type === 'completion' && target.completion && (
          <CompletionCertificate data={target.completion} />
        )}
        {target.type === 'hours' && target.hours && (
          <HoursCertificate data={target.hours} />
        )}
      </div>

      <div className="cert-preview-actions screen-only" onClick={e => e.stopPropagation()}>
        <button onClick={handleDownload} disabled={downloading}
          className="btn btn-fox btn-sm">
          {downloading ? '下载中…' : '📥 下载 PDF'}
        </button>
        <button onClick={handlePrint} className="btn btn-outline btn-sm">🖨️ 打印</button>
        <button onClick={onClose} className="btn btn-ghost btn-sm">关闭</button>
      </div>
    </div>
  );
}
