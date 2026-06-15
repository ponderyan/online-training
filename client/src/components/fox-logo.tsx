'use client';

/**
 * FoxLearn 品牌 LOGO
 *
 * 使用方式：
 * <FoxLogo size={48} />
 * <FoxLogo size={48} showText />
 * <FoxLogo.Horizontal />   // 狐狸图标 + FoxLearn + 狐学 水平排列
 */

function FoxSVG({ size = 48 }: { size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" className="flex-shrink-0">
      {/* 左耳 */}
      <path d="M20,28 L12,6 L32,22Z" fill="#e87a30" />
      {/* 右耳 */}
      <path d="M44,28 L52,6 L32,22Z" fill="#e87a30" />
      {/* 头部 */}
      <ellipse cx="32" cy="34" rx="18" ry="16" fill="#e87a30" />
      {/* 面部 */}
      <ellipse cx="32" cy="37" rx="13" ry="10" fill="#fce6d3" opacity="0.7" />
      {/* 左眼 */}
      <ellipse cx="26" cy="31" rx="2" ry="2.8" fill="#1a1712" />
      <ellipse cx="26.5" cy="30" rx="0.8" ry="1.2" fill="#fff" opacity="0.7" />
      {/* 右眼 */}
      <ellipse cx="38" cy="31" rx="2" ry="2.8" fill="#1a1712" />
      <ellipse cx="38.5" cy="30" rx="0.8" ry="1.2" fill="#fff" opacity="0.7" />
      {/* 鼻子 */}
      <ellipse cx="32" cy="38" rx="2" ry="1.5" fill="#c9601e" />
      {/* 嘴 */}
      <path d="M29,40.5 Q32,44 35,40.5" stroke="#c9601e" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* 尾巴 */}
      <path d="M48,52 C56,48 58,40 54,36 C50,40 46,44 48,52Z" fill="#e87a30" opacity="0.85" />
    </svg>
  );
}

function FoxLogo({ size = 48, showText = false }: { size?: number; showText?: boolean }) {
  if (!showText) return <FoxSVG size={size} />;

  return (
    <div className="flex items-center gap-3">
      <FoxSVG size={size} />
      <div>
        <div className="font-serif font-bold leading-tight tracking-wider text-white">FoxLearn</div>
        <div className="text-[11px] text-[#f5a061] font-light tracking-widest mt-0.5">狐学</div>
      </div>
    </div>
  );
}

// 浅色背景版本（用于登录页等亮色场景）
FoxLogo.Light = function FoxLogoLight({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <FoxSVG size={size} />
      <div>
        <div className="font-serif font-bold leading-tight tracking-wider" style={{ color: 'var(--ink-800)' }}>
          FoxLearn
        </div>
        <div className="text-[10px] tracking-[0.15em]" style={{ color: 'var(--fox)' }}>
          狐学
        </div>
      </div>
    </div>
  );
};

export default FoxLogo;
