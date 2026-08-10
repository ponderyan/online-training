// 视频课程管理共享常量与工具（自 page.tsx 迁出，纯重构零行为变化）

export const TYPE_NAMES: Record<string, string> = { PUBLIC: '公共课', SPECIALIZED: '专项课' };
export const TYPE_COLORS: Record<string, string> = { PUBLIC: 'var(--info)', SPECIALIZED: 'var(--blue)' };
export const STATUS_NAMES: Record<string, string> = { DRAFT: '草稿', PUBLISHED: '已上架', UNPUBLISHED: '已下架' };
export const STATUS_COLORS: Record<string, string> = { DRAFT: 'var(--ink-300)', PUBLISHED: 'var(--sage)', UNPUBLISHED: 'var(--error)' };

export const assetUrl = (path: string) =>
  process.env.NODE_ENV === 'production' ? path : `http://localhost:3001${path}`;

export const parseDuration = (val: string) => {
  if (/^\d+:\d+:\d+$/.test(val)) { const [h, m, s] = val.split(':').map(Number); return h * 3600 + m * 60 + s; }
  if (/^\d+:\d+$/.test(val)) { const [m, s] = val.split(':').map(Number); return m * 60 + s; }
  return parseInt(val) || 0;
};

export const fmtDuration = (sec: number) => {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};
