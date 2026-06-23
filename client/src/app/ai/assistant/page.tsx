'use client';

import AppLayout from '@/components/app-layout';
import FoxLogo from '@/components/fox-logo';

export default function AiAssistantPage() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-24">
        <FoxLogo size={80} />
        <h1 className="text-3xl font-bold mt-6 mb-4" style={{ color: 'var(--ink-700)' }}>🦊 AI 助教</h1>
        <p className="text-lg mb-3" style={{ color: 'var(--ink-400)' }}>
          AI 智能助教功能正在开发中，敬请期待！
        </p>
        <div className="card p-5 mt-4 max-w-md text-center">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-600)' }}>预计功能</h3>
          <div className="space-y-2 text-sm" style={{ color: 'var(--ink-400)' }}>
            <p>💡 基于教材的知识问答</p>
            <p>📖 学习辅导与答疑解惑</p>
            <p>🎯 错题分析与薄弱点诊断</p>
            <p>📊 个性化学习路径推荐</p>
          </div>
        </div>
        <div className="mt-8 text-xs" style={{ color: 'var(--ink-300)' }}>
          FoxLearn · 狐学
        </div>
      </div>
    </AppLayout>
  );
}
