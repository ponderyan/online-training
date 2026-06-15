'use client';

import { useRouter } from 'next/navigation';

export default function PrototypesPage() {
  const router = useRouter();

  const items = [
    {
      path: '/prototypes/exam-sessions',
      icon: '🏫',
      title: '考试场次管理',
      desc: '管理端创建/管理考试场次，支持统一开考和随到随考两种模式',
      tag: '管理端',
      color: 'var(--fox)',
    },
    {
      path: '/prototypes/student-exams',
      icon: '📋',
      title: '学员端 · 我的考试',
      desc: '学员看到的考试卡片列表、待考/进行中/已完成状态流转',
      tag: '学员端',
      color: 'var(--cyan)',
    },
    {
      path: '/prototypes/online-exam',
      icon: '✏️',
      title: '在线答题',
      desc: '最核心的答题交互：逐题作答、答题卡导航、计时器、交卷确认',
      tag: '学员端',
      color: 'var(--gold-dark)',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'linear-gradient(135deg, #f6f1e8 0%, #efe9dc 50%, #e4dccd 100%)' }}>
      <div className="max-w-3xl w-full animate-fadeSlide">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🦊</div>
          <h1 className="text-xl font-serif font-bold" style={{ color: 'var(--ink-800)' }}>FoxLearn 二期 · 交互原型</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-400)' }}>
            点击查看高保真原型 · 每个原型包含模拟数据和可交互流程
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>二期规划中</span>
            <span className="text-xs" style={{ color: 'var(--ink-300)' }}>待需求确认后进入开发</span>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} onClick={() => router.push(item.path)}
              className="card p-6 cursor-pointer transition-all hover:-translate-y-1 group"
              style={{ borderLeft: `4px solid ${item.color}40` }}
              onMouseEnter={e => e.currentTarget.style.borderLeftColor = item.color}
              onMouseLeave={e => e.currentTarget.style.borderLeftColor = `${item.color}40`}>
              <div className="flex items-start gap-5">
                <div className="text-3xl mt-0.5 flex-shrink-0">{item.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-serif font-bold text-base" style={{ color: 'var(--ink-800)' }}>{item.title}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: item.tag === '管理端' ? 'var(--fox-glow)' : 'var(--cyan-glow)', color: item.tag === '管理端' ? 'var(--fox-dark)' : 'var(--cyan)' }}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--ink-400)' }}>{item.desc}</p>
                </div>
                <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--fox)' }}>→</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-5 rounded-lg text-xs text-center" style={{ background: 'var(--fox-glow)', color: 'var(--fox-dark)' }}>
          🦊 原型已部署在服务器上，用手机或电脑浏览器都能打开查看。
          <br />等你回来一起审，确认需求后再进入开发。
        </div>
      </div>
    </div>
  );
}
