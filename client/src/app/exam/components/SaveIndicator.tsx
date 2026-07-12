'use client';

export default function SaveIndicator({ status, lastSaved }: { status: 'idle' | 'saving' | 'saved' | 'error'; lastSaved?: string }) {
  if (status === 'idle') return null;

  const config: Record<string, { className: string; icon: string; label: string }> = {
    saving: { className: 'bg-[var(--gold-glow)] text-[var(--gold-dark)]', icon: '⏳', label: '保存中…' },
    saved: { className: 'bg-[var(--sage-glow)] text-[var(--sage)]', icon: '✓', label: lastSaved ? `已保存 ${new Date(lastSaved).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '已保存' },
    error: { className: 'bg-[var(--verm-glow)] text-[var(--verm)]', icon: '✗', label: '保存失败' },
  };

  const s = config[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${s.className}`}>
      <span>{s.icon}</span>
      <span>{s.label}</span>
    </div>
  );
}
