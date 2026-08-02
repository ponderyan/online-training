'use client';

interface NetworkErrorScreenProps {
  onRetry: () => Promise<void>;
}

/**
 * 网络错误全屏提示
 */
export default function NetworkErrorScreen({ onRetry }: NetworkErrorScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--paper)]">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold mb-2 text-[var(--ink-700)]">网络连接异常</h2>
        <p className="text-sm mb-4 text-[var(--ink-400)]">检测到网络不稳定，但你的答题数据已保存，请不要关闭页面</p>
        <p className="text-xs text-[var(--ink-300)] mb-6">系统每 10 秒自动尝试重连，你也可以手动重试</p>
        <button onClick={onRetry}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-[var(--fox)] text-white border-none cursor-pointer hover:bg-[var(--fox-dark)] transition-all">
          🔄 手动重试
        </button>
      </div>
    </div>
  );
}
