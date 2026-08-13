import type { CanvasDef, TemplateData } from '@/lib/canvas-renderer/types';

// ── 默认画布 ──
export const DEFAULT_CANVAS: CanvasDef = {
  width: 1123, height: 794, background: 'var(--paper-50)',
  elements: [
    { id: 'border', type: 'rect', x: 30, y: 30, width: 1063, height: 734, name: '边框', props: { fill: 'transparent', stroke: 'var(--fox-dark)', strokeWidth: 3, radius: 8 } },
    { id: 'title', type: 'text', x: 360, y: 80, width: 400, height: 60, name: '标题', props: { content: '结业证书', fontSize: 42, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: 'var(--fox-dark)', textAlign: 'center' } },
    { id: 'body', type: 'variable-text', x: 150, y: 250, width: 820, height: 120, name: '正文', props: { template: '兹证明 {{studentName}} 同志参加 {{courseName}} 培训课程，经考核成绩合格，特发此证。', fontSize: 22, fontFamily: 'SimSun, serif', color: 'var(--neutral-700)', lineHeight: 1.8 } },
    { id: 'date', type: 'auto-field', x: 700, y: 650, width: 300, height: 30, name: '发证日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'SimSun, serif', color: 'var(--neutral-500)', textAlign: 'right' } },
    { id: 'divider1', type: 'divider', x: 150, y: 420, width: 820, height: 0, name: '分割线', props: { style: 'solid', color: 'var(--neutral-200)', thickness: 1 } },
  ],
};

export const DEFAULT_DATA: TemplateData = { studentName: '张三', courseName: '人工智能应用', certificateNo: 'CERT-2026-001', issueDate: '2026-07-30', orgName: '示例机构', issuerName: '示例签发单位', footerText: '本证书由示例机构签发 · 扫码可在线查验', programName: '示例培训班', verificationCode: 'FXV-DEMO-2026-0001' };

export const AVAILABLE_VARS = [
  { key: 'studentName', label: '姓名' },
  { key: 'courseName', label: '课程名' },
  { key: 'certificateNo', label: '证书编号' },
  { key: 'issueDate', label: '发证日期' },
  { key: 'orgName', label: '机构名' },
  { key: 'idCard', label: '身份证(完整)' },
  { key: 'idCardMasked', label: '身份证(脱敏)' },
  { key: 'totalHours', label: '总学时' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
  { key: 'verificationCode', label: '防伪验证码' },
  // ★ 2026-08-13 机构配置注入变量
  { key: 'issuerName', label: '签发单位' },
  { key: 'footerText', label: '底部说明' },
  { key: 'programName', label: '培训班' },
  { key: 'orgLogoDataUrl', label: '机构Logo' },
  { key: 'orgSealDataUrl', label: '机构印章' },
];

/** 变量芯片渲染用的中文标签表 */
export const VAR_LABELS: Record<string, string> = { studentName: '姓名', courseName: '课程', certificateNo: '编号', issueDate: '日期', orgName: '机构', idCard: '身份证', idCardMasked: '身份证(脱敏)', totalHours: '学时', startDate: '开始', endDate: '结束', verificationCode: '防伪验证码', issuerName: '签发单位', footerText: '底部说明', programName: '培训班', orgLogoDataUrl: '机构Logo', orgSealDataUrl: '机构印章' };

let idCounter = 200;
export function genId() { return `el_${++idCounter}_${Date.now().toString(36)}`; }
export const clampScale = (s: number) => Math.min(2, Math.max(0.2, Math.round(s * 100) / 100));

// ── 样式常量 ──
export const toolBtnStyle: React.CSSProperties = { padding: '3px 8px', background: 'none', border: '1px solid var(--ink-100)', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
export const inputStyle: React.CSSProperties = { flex: 1, padding: '2px 6px', border: '1px solid var(--ink-100)', borderRadius: 3, fontSize: 12, minWidth: 0 };
export const layerBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '0 2px' };
export function tabStyle(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '6px 0', border: 'none', background: active ? '#fff' : 'var(--neutral-50)', borderBottom: active ? '2px solid #e87d30' : '2px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400 };
}
