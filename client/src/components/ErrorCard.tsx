'use client';

/**
 * 错误卡片 —— 接口失败 / 加载异常时的内联提示
 *
 * 用法：
 *   {error && <ErrorCard message={error} onRetry={() => load()} />}
 *   <ErrorCard message="加载失败" description="请稍后重试，或联系管理员" onRetry={reload} />
 */
interface ErrorCardProps {
  /** 错误标题或错误信息 */
  message?: string;
  /** 附加说明 */
  description?: string;
  /** 重新加载回调；提供则显示「重新加载」按钮 */
  onRetry?: () => void;
  /** 重试按钮文案 */
  retryText?: string;
  /** 内边距档位 */
  size?: 'default' | 'small';
}

export default function ErrorCard({
  message = '加载失败',
  description = '请稍后重试，或联系管理员',
  onRetry,
  retryText = '重新加载',
  size = 'default',
}: ErrorCardProps) {
  const py = size === 'small' ? 'py-8' : 'py-12';
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${py} px-4`}
      role="alert"
    >
      <div style={{ fontSize: '2.2rem', lineHeight: 1, marginBottom: 10 }} aria-hidden>
        ❌
      </div>
      <p className="font-medium" style={{ color: 'var(--verm)', fontSize: '0.92rem', marginBottom: 4 }}>
        {message}
      </p>
      {description && (
        <p style={{ color: 'var(--ink-300)', fontSize: '0.8rem', maxWidth: 360 }}>{description}</p>
      )}
      {onRetry && (
        <button className="btn btn-outline btn-sm mt-4" onClick={onRetry}>
          🔄 {retryText}
        </button>
      )}
    </div>
  );
}
