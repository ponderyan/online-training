'use client';

/**
 * 圆环进度条（SVG stroke-dasharray 实现）
 * - 百分比 < 100：fox 色（进行中）
 * - 百分百 = 100：sage 色 + 对勾（完成）
 */
export default function CircularProgress({
  percentage,
  size = 140,
  strokeWidth = 12,
  label,
  sublabel,
}: {
  percentage: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;   // 中心主文字（默认显示百分比）
  sublabel?: string; // 中心副文字（默认"完成"/"进行中"）
}) {
  const pct = Math.max(0, Math.min(100, percentage));
  const done = pct >= 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = done ? 'var(--sage)' : 'var(--fox)';

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="cp-track"
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="cp-fill"
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="cp-center">
        {done ? (
          <span style={{ fontSize: size * 0.32, color, lineHeight: 1 }}>✓</span>
        ) : (
          <span className="num" style={{ fontSize: size * 0.22, fontWeight: 700, color: 'var(--ink-700)', fontFamily: 'var(--font-serif)' }}>
            {label ?? `${Math.round(pct)}%`}
          </span>
        )}
        <span style={{ fontSize: size * 0.1, color: 'var(--ink-400)', marginTop: 2 }}>
          {sublabel ?? (done ? '已完成' : '完成')}
        </span>
      </div>
    </div>
  );
}
