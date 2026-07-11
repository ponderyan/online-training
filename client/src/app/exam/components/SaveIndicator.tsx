'use client';

export default function SaveIndicator({ status, lastSaved }: { status: 'idle' | 'saving' | 'saved' | 'error'; lastSaved?: string }) {
  if (status === 'idle') return null;

  const styles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    saving: { bg: '#fef3c7', text: '#92400e', icon: '⏳', label: '保存中…' },
    saved: { bg: '#ecfdf5', text: '#065f46', icon: '✓', label: lastSaved ? `已保存 ${new Date(lastSaved).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '已保存' },
    error: { bg: '#fef2f2', text: '#991b1b', icon: '✗', label: '保存失败' },
    idle: { bg: 'transparent', text: '', icon: '', label: '' },
  };

  const s = styles[status];

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      <span>{s.icon}</span>
      <span>{s.label}</span>
    </div>
  );
}
