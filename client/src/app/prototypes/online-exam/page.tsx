'use client';

import { useState, useEffect } from 'react';

/** 二期原型：在线答题界面 */
export default function OnlineExamPrototype() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(7200); // 120 min in seconds
  const [examSubmitted, setExamSubmitted] = useState(false);

  // Timer
  useEffect(() => {
    if (examSubmitted) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [examSubmitted]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Simulated questions
  const questions = [
    { id: 1, type: 'SINGLE_CHOICE', typeLabel: '单选题', difficulty: '易', score: 2, content: '数字化转型是指什么？', options: [
      { label: 'A', content: '利用数字技术改变业务模式、运营流程和客户体验，创造新的价值和增长机会' },
      { label: 'B', content: '购买最新的软件和硬件设备' },
      { label: 'C', content: '建立企业官方网站和社交媒体账号' },
      { label: 'D', content: '将纸质文档全部转换为电子文档' },
    ]},
    { id: 2, type: 'SINGLE_CHOICE', typeLabel: '单选题', difficulty: '易', score: 2, content: '以下哪项不属于企业数字化转型的关键要素？', options: [
      { label: 'A', content: '战略规划' },
      { label: 'B', content: '技术架构' },
      { label: 'C', content: '办公场地选址' },
      { label: 'D', content: '数据治理' },
    ]},
    { id: 3, type: 'MULTIPLE_CHOICE', typeLabel: '多选题', difficulty: '较易', score: 3, content: '企业数字化转型的关键要素包括哪些？（多选）', options: [
      { label: 'A', content: '战略规划' },
      { label: 'B', content: '技术架构' },
      { label: 'C', content: '数据治理' },
      { label: 'D', content: '人才培养' },
      { label: 'E', content: '组织变革' },
    ]},
    { id: 4, type: 'TRUE_FALSE', typeLabel: '判断题', difficulty: '易', score: 2, content: '数字化转型就是简单的技术升级。', options: [
      { label: '✓', content: '正确' },
      { label: '✗', content: '错误' },
    ]},
    { id: 5, type: 'TRUE_FALSE', typeLabel: '判断题', difficulty: '易', score: 2, content: '数据治理的作用是确保数据的质量、安全和合规使用。', options: [
      { label: '✓', content: '正确' },
      { label: '✗', content: '错误' },
    ]},
    { id: 6, type: 'FILL_BLANK', typeLabel: '填空题', difficulty: '较易', score: 2, content: '企业数字化转型的关键要素包括战略规划、技术架构、数据治理、______和组织变革。' },
    { id: 7, type: 'SHORT_ANSWER', typeLabel: '简答题', difficulty: '较易', score: 5, content: '请简述数字化转型的定义。' },
  ];

  const q = questions[currentQ];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  const isAnswered = (qi: number) => answers[qi] !== undefined;
  const isFlagged = (qi: number) => flagged.has(qi);

  const handleAnswer = (value: any) => {
    if (q.type === 'MULTIPLE_CHOICE') {
      const current = (answers[currentQ] as string[]) || [];
      const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
      setAnswers({ ...answers, [currentQ]: next });
    } else if (q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') {
      setAnswers({ ...answers, [currentQ]: value });
    } else {
      setAnswers({ ...answers, [currentQ]: value });
    }
  };

  // Submitted state
  if (examSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="card max-w-md w-full p-10 text-center animate-fadeSlide">
          <div className="text-5xl mb-5">✅</div>
          <h2 className="font-serif font-bold text-lg mb-2" style={{ color: 'var(--ink-800)' }}>答卷已提交</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-400)' }}>你的答卷已成功提交，客观题部分已自动判分。</p>
          <div className="p-4 rounded-lg mb-5 text-left" style={{ background: 'var(--paper)' }}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs" style={{ color: 'var(--ink-300)' }}>已答</span>
                <p className="font-bold" style={{ color: 'var(--ink-800)' }}>{answeredCount}/{totalQuestions} 题</p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--ink-300)' }}>用时</span>
                <p className="font-bold" style={{ color: 'var(--ink-800)' }}>{formatTime(7200 - timeLeft)}</p>
              </div>
            </div>
          </div>
          <button onClick={() => { setExamSubmitted(false); setAnswers({}); setCurrentQ(0); setTimeLeft(7200); }}
            className="btn btn-ink btn-sm">返回考试列表</button>
          <p className="text-xs mt-4" style={{ color: 'var(--ink-300)' }}>
            🦊 主观题将由阅卷人人工判分，请耐心等待。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Top bar */}
      <header className="border-b flex-shrink-0" style={{ background: 'var(--paper-bright)', borderColor: 'var(--ink-100)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-sm" style={{ color: 'var(--ink-800)' }}>🦊 FoxLearn</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>考试中</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>进度</span>
              <div className="w-32 h-1.5 rounded-full" style={{ background: 'var(--paper-dark)' }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / totalQuestions) * 100}%`, background: 'var(--fox)' }} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>{answeredCount}/{totalQuestions}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: timeLeft < 300 ? 'var(--verm)' : 'var(--ink-800)' }}>
              <span>⏱</span>
              <span className={timeLeft < 300 ? 'animate-pulse' : ''}>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl mx-auto w-full px-6 py-6 gap-6 min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Question card */}
          <div className="card flex-1 p-8 flex flex-col min-h-0 overflow-y-auto">
            {/* Question header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b" style={{ borderColor: 'var(--ink-100)' }}>
              <span className={`text-xs px-2.5 py-1 rounded font-medium ${
                q.type === 'SINGLE_CHOICE' ? 'tag-cyan' :
                q.type === 'MULTIPLE_CHOICE' ? 'tag-gold' :
                q.type === 'TRUE_FALSE' ? 'tag-ink' :
                q.type === 'FILL_BLANK' ? 'tag-fox' : 'tag-verm'
              }`}>
                {q.typeLabel}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>第 {currentQ + 1} 题 · 共 {totalQuestions} 题</span>
              <span className="text-xs" style={{ color: 'var(--ink-300)' }}>难度：{q.difficulty}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--fox)' }}>{q.score}分</span>
              <button onClick={() => {
                const next = new Set(flagged);
                if (next.has(currentQ)) next.delete(currentQ); else next.add(currentQ);
                setFlagged(next);
              }}
                className="ml-auto text-sm bg-transparent border-none cursor-pointer"
                style={{ color: isFlagged(currentQ) ? 'var(--gold)' : 'var(--ink-300)' }}>
                {isFlagged(currentQ) ? '⛳ 已标记' : '🏳 标记'}
              </button>
            </div>

            {/* Question content */}
            <div className="flex-1">
              <div className="text-base leading-relaxed mb-6" style={{ color: 'var(--ink-800)', lineHeight: 1.8 }}>
                {q.content}
              </div>

              {/* Options */}
              {q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    const isMulti = q.type === 'MULTIPLE_CHOICE';
                    const selected = isMulti
                      ? (answers[currentQ] || []).includes(opt.label)
                      : answers[currentQ] === opt.label;
                    const isTrueFalse = q.type === 'TRUE_FALSE';

                    return (
                      <div key={i} onClick={() => handleAnswer(opt.label)}
                        className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all border ${
                          selected
                            ? 'border-[var(--fox)]'
                            : 'border-transparent'
                        }`}
                        style={{
                          background: selected ? 'var(--fox-glow)' : 'var(--paper)',
                        }}>
                        {/* Label circle */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                          selected ? 'text-white' : ''
                        }`}
                          style={{
                            background: selected ? 'var(--fox)' : 'var(--paper-dark)',
                            color: selected ? '#fff' : 'var(--ink-400)',
                          }}>
                          {isTrueFalse ? (opt.label === '✓' ? '✓' : '✗') : opt.label}
                        </div>
                        <span className={`text-sm ${selected ? 'font-medium' : ''}`}
                          style={{ color: selected ? 'var(--fox-dark)' : 'var(--ink-600)' }}>
                          {opt.content}
                        </span>
                        {selected && <span className="ml-auto text-sm" style={{ color: 'var(--fox)' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fill in blank */}
              {q.type === 'FILL_BLANK' && (
                <div>
                  <input
                    value={(answers[currentQ] as string) || ''}
                    onChange={e => handleAnswer(e.target.value)}
                    className="input text-base"
                    placeholder="请输入答案…"
                    autoFocus
                    style={{ borderStyle: 'dashed', borderWidth: '2px' }}
                  />
                </div>
              )}

              {/* Short answer */}
              {q.type === 'SHORT_ANSWER' && (
                <div>
                  <textarea
                    value={(answers[currentQ] as string) || ''}
                    onChange={e => handleAnswer(e.target.value)}
                    className="input textarea text-base"
                    rows={6}
                    placeholder="请输入你的答案…"
                    style={{ borderStyle: 'dashed', borderWidth: '2px' }}
                  />
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                className="btn btn-ghost btn-sm" style={{ opacity: currentQ === 0 ? 0.3 : 1 }}>
                ← 上一题
              </button>
              <button onClick={() => setShowSubmitModal(true)}
                className="btn btn-outline btn-sm" style={{ color: 'var(--verm)', borderColor: 'var(--verm-glow)' }}>
                交卷
              </button>
              <button onClick={() => setCurrentQ(Math.min(totalQuestions - 1, currentQ + 1))} disabled={currentQ === totalQuestions - 1}
                className="btn btn-ghost btn-sm" style={{ opacity: currentQ === totalQuestions - 1 ? 0.3 : 1 }}>
                下一题 →
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar — question navigator */}
        <div className="w-56 flex-shrink-0">
          <div className="card p-4 sticky" style={{ top: '1rem' }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--ink-400)' }}>答题卡</h4>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`w-full aspect-square rounded text-xs font-medium transition-all cursor-pointer border-none ${
                    currentQ === i ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{
                    background: isAnswered(i) ? 'var(--fox)' : (isFlagged(i) ? 'var(--gold-glow)' : 'var(--paper-dark)'),
                    color: isAnswered(i) ? '#fff' : (isFlagged(i) ? 'var(--gold-dark)' : 'var(--ink-400)'),
                    // ringColor: 'var(--fox)',
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t text-xs" style={{ borderColor: 'var(--ink-100)', color: 'var(--ink-300)' }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--fox)' }} />
                <span>已作答</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--paper-dark)' }} />
                <span>未作答</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: 'var(--gold-glow)' }} />
                <span>已标记</span>
              </div>
            </div>

            <button onClick={() => setShowSubmitModal(true)}
              className="btn btn-fox w-full mt-4 btn-sm">
              交卷
            </button>
          </div>
        </div>
      </div>

      {/* Submit confirmation */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSubmitModal(false); }}>
          <div className="modal-card max-w-[420px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">确认交卷</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-4 rounded-lg" style={{ background: 'var(--paper)' }}>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold" style={{ color: 'var(--ink-800)' }}>{answeredCount}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-300)' }}>已作答</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold" style={{ color: 'var(--gold-dark)' }}>{flagged.size}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-300)' }}>已标记</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold" style={{ color: 'var(--verm)' }}>{totalQuestions - answeredCount}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-300)' }}>未作答</div>
                  </div>
                </div>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <div className="text-sm p-3 rounded-lg" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
                  ⚠ 还有 {totalQuestions - answeredCount} 道题未作答，确定要交卷吗？
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--ink-300)' }}>
                交卷后客观题自动判分，主观题由阅卷人评分。
              </p>
            </div>
            <div className="modal-footer gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-ghost btn-sm">继续答题</button>
              <button onClick={() => { setExamSubmitted(true); setShowSubmitModal(false); }}
                className="btn btn-verm btn-sm">确认交卷</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
