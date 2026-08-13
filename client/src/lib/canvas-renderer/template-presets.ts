/**
 * FoxLearn 证书模板预设库
 * 内置常用证书版式，用户可"从模板创建"快速开始
 * 画布基准尺寸：1123 × 794（A4 横向 @96dpi）
 */
import type { CanvasDef } from './types';

export interface TemplatePreset {
  key: string;
  name: string;
  description: string;
  /** 主题色（用于列表卡片标识） */
  accent: string;
  canvas: CanvasDef;
}

const W = 1123;
const H = 794;

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ── 1. 经典结业证书（暖棕复古） ──
  {
    key: 'classic',
    name: '经典结业证书',
    description: '棕色边框 · 宋体 · 传统庄重',
    accent: '#8B4513',
    canvas: {
      width: W, height: H, background: '#fffdf5', version: 2,
      elements: [
        { id: 'p1_border', type: 'rect', x: 30, y: 30, width: 1063, height: 734, name: '外边框', layer: 'design', props: { fill: 'transparent', stroke: '#8B4513', strokeWidth: 3, radius: 8 } },
        { id: 'p1_border2', type: 'rect', x: 42, y: 42, width: 1039, height: 710, name: '内边框', layer: 'design', props: { fill: 'transparent', stroke: '#C89B6C', strokeWidth: 1, radius: 6 } },
        { id: 'p1_title', type: 'text', x: 361, y: 90, width: 400, height: 64, name: '标题', layer: 'design', props: { content: '结业证书', fontSize: 44, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: '#8B4513', textAlign: 'center' } },
        { id: 'p1_sub', type: 'text', x: 361, y: 160, width: 400, height: 28, name: '英文副题', layer: 'design', props: { content: 'CERTIFICATE OF COMPLETION', fontSize: 13, fontFamily: 'Georgia, serif', color: '#B08050', textAlign: 'center' } },
        { id: 'p1_body', type: 'variable-text', x: 150, y: 260, width: 823, height: 130, name: '正文', props: { template: '兹证明 {{studentName}} 同志参加 {{courseName}} 培训课程，经考核成绩合格，特发此证。', fontSize: 22, fontFamily: 'SimSun, serif', color: '#333', lineHeight: 1.9 } },
        { id: 'p1_div', type: 'divider', x: 150, y: 440, width: 823, height: 0, name: '分割线', layer: 'design', props: { style: 'solid', color: '#E0C9A6', thickness: 1 } },
        { id: 'p1_org', type: 'variable-text', x: 150, y: 640, width: 400, height: 30, name: '发证机构', props: { template: '{{orgName}}', fontSize: 18, fontFamily: 'SimSun, serif', color: '#555', textAlign: 'left' } },
        { id: 'p1_date', type: 'auto-field', x: 673, y: 640, width: 300, height: 30, name: '发证日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'SimSun, serif', color: '#666', textAlign: 'right' } },
        { id: 'p1_no', type: 'variable-text', x: 150, y: 690, width: 400, height: 24, name: '证书编号', props: { template: '证书编号：{{certificateNo}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999', textAlign: 'left' } },
        { id: 'p1_qr', type: 'qrcode', x: 940, y: 560, width: 100, height: 100, name: '验证二维码', props: { dataTemplate: 'https://verify.example.com/{{certificateNo}}', label: '扫码验证', labelFontSize: 10 } },
      ],
    },
  },

  // ── 2. 荣誉证书（红金正式） ──
  {
    key: 'honor',
    name: '荣誉证书',
    description: '红金配色 · 双边框 · 表彰场景',
    accent: '#C62828',
    canvas: {
      width: W, height: H, background: '#FFFBF0', version: 2,
      elements: [
        { id: 'p2_border', type: 'rect', x: 26, y: 26, width: 1071, height: 742, name: '外边框', layer: 'design', props: { fill: 'transparent', stroke: '#C62828', strokeWidth: 4, radius: 0 } },
        { id: 'p2_border2', type: 'rect', x: 40, y: 40, width: 1043, height: 714, name: '金内框', layer: 'design', props: { fill: 'transparent', stroke: '#D4A017', strokeWidth: 2, radius: 0 } },
        { id: 'p2_star', type: 'text', x: 511, y: 70, width: 100, height: 50, name: '星徽', layer: 'design', props: { content: '★', fontSize: 40, fontFamily: 'serif', color: '#D4A017', textAlign: 'center' } },
        { id: 'p2_title', type: 'text', x: 361, y: 125, width: 400, height: 64, name: '标题', layer: 'design', props: { content: '荣 誉 证 书', fontSize: 46, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#C62828', textAlign: 'center' } },
        { id: 'p2_sub', type: 'text', x: 361, y: 195, width: 400, height: 26, name: '英文副题', layer: 'design', props: { content: 'CERTIFICATE OF HONOR', fontSize: 13, fontFamily: 'Georgia, serif', color: '#B8860B', textAlign: 'center' } },
        { id: 'p2_body', type: 'variable-text', x: 150, y: 270, width: 823, height: 130, name: '正文', props: { template: '{{studentName}} 同志在 {{courseName}} 培训中表现优异，成绩突出，特授予荣誉称号，以资鼓励。', fontSize: 22, fontFamily: 'SimSun, serif', color: '#333', lineHeight: 1.9 } },
        { id: 'p2_org', type: 'variable-text', x: 150, y: 640, width: 400, height: 30, name: '颁奖机构', props: { template: '{{orgName}}', fontSize: 18, fontFamily: 'SimSun, serif', color: '#555', textAlign: 'left' } },
        { id: 'p2_date', type: 'auto-field', x: 673, y: 640, width: 300, height: 30, name: '颁发日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'SimSun, serif', color: '#666', textAlign: 'right' } },
        { id: 'p2_seal', type: 'seal', x: 800, y: 520, width: 130, height: 130, name: '印章', props: { shape: 'circle', text: '培训认证专用章', subText: '★', color: '#C62828', fontSize: 12 } },
        { id: 'p2_no', type: 'variable-text', x: 150, y: 690, width: 400, height: 24, name: '证书编号', props: { template: '编号：{{certificateNo}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999', textAlign: 'left' } },
      ],
    },
  },

  // ── 3. 学时证明（蓝色清爽） ──
  {
    key: 'hours',
    name: '学时证明',
    description: '蓝色主题 · 含学时字段 · 简洁',
    accent: '#1565C0',
    canvas: {
      width: W, height: H, background: '#FFFFFF', version: 2,
      elements: [
        { id: 'p3_bar', type: 'rect', x: 0, y: 0, width: 1123, height: 14, name: '顶部色条', layer: 'design', props: { fill: '#1565C0', stroke: '#1565C0', strokeWidth: 0, radius: 0 } },
        { id: 'p3_bar2', type: 'rect', x: 0, y: 780, width: 1123, height: 14, name: '底部色条', layer: 'design', props: { fill: '#1565C0', stroke: '#1565C0', strokeWidth: 0, radius: 0 } },
        { id: 'p3_logo', type: 'image', x: 150, y: 52, width: 150, height: 42, name: '机构Logo', layer: 'design', props: { src: '{{orgLogoDataUrl}}', fit: 'contain' } },
        { id: 'p3_title', type: 'text', x: 361, y: 80, width: 400, height: 60, name: '标题', layer: 'design', props: { content: '学 时 证 明', fontSize: 42, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#1565C0', textAlign: 'center' } },
        { id: 'p3_sub', type: 'text', x: 361, y: 148, width: 400, height: 26, name: '英文副题', layer: 'design', props: { content: 'LEARNING HOURS CERTIFICATE', fontSize: 13, fontFamily: 'Arial, sans-serif', color: '#64B5F6', textAlign: 'center' } },
        { id: 'p3_body', type: 'variable-text', x: 150, y: 218, width: 823, height: 100, name: '正文', props: { template: '兹证明 {{studentName}} 于 {{startDate}} 至 {{endDate}} 期间参加 {{programName}} 培训，累计完成 {{totalHours}} 学时，成绩合格，特此证明。', fontSize: 20, fontFamily: 'SimSun, serif', color: '#333', lineHeight: 1.9 } },
        { id: 'p3_table', type: 'table', x: 150, y: 340, width: 520, height: 120, name: '学时明细', props: { dataVariable: 'hoursDetail', columns: [{ key: 'typeName', label: '学时类型' }, { key: 'hours', label: '学时(小时)', align: 'right' }], showTotal: true, totalKey: 'hours', totalLabel: '合计', borderColor: '#90CAF9', headerBg: '#E3F2FD', color: '#444', fontSize: 14, fontFamily: 'SimSun, serif' } },
        { id: 'p3_id', type: 'variable-text', x: 150, y: 500, width: 500, height: 26, name: '身份证号', props: { template: '身份证号：{{idCardMasked}}', fontSize: 14, fontFamily: 'SimSun, serif', color: '#666', textAlign: 'left' } },
        { id: 'p3_no', type: 'variable-text', x: 150, y: 534, width: 500, height: 24, name: '证书编号', props: { template: '证书编号：{{certificateNo}} · 防伪验证码：{{verificationCode}}', fontSize: 13, fontFamily: 'SimSun, serif', color: '#999', textAlign: 'left' } },
        { id: 'p3_seal', type: 'seal', x: 905, y: 470, width: 120, height: 120, name: '机构印章', props: { src: '{{orgSealDataUrl}}', shape: 'circle', text: '学时证明专用章', subText: '★', color: '#C62828', fontSize: 11 } },
        { id: 'p3_qr', type: 'qrcode', x: 940, y: 620, width: 100, height: 100, name: '验证二维码', props: { dataTemplate: '{{qrDataUrl}}', label: '扫码核验', labelFontSize: 10 } },
        { id: 'p3_org', type: 'variable-text', x: 150, y: 640, width: 400, height: 30, name: '出具单位', props: { template: '{{issuerName}}', fontSize: 18, fontFamily: 'SimSun, serif', color: '#444', textAlign: 'left' } },
        { id: 'p3_date', type: 'auto-field', x: 673, y: 640, width: 300, height: 30, name: '出具日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'SimSun, serif', color: '#666', textAlign: 'right' } },
        { id: 'p3_hash', type: 'variable-text', x: 150, y: 676, width: 500, height: 22, name: '防伪指纹', props: { template: '防伪指纹：{{sealHash}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#999', textAlign: 'left' } },
        { id: 'p3_footer', type: 'variable-text', x: 150, y: 720, width: 823, height: 26, name: '底部说明', layer: 'design', props: { template: '{{footerText}}', fontSize: 12, fontFamily: 'SimSun, serif', color: '#888', textAlign: 'center' } },
      ],
    },
  },

  // ── 4. 现代简约（灰黑极简） ──
  {
    key: 'modern',
    name: '现代简约',
    description: '极简灰黑 · 左对齐 · 现代感',
    accent: '#37474F',
    canvas: {
      width: W, height: H, background: '#FFFFFF', version: 2,
      elements: [
        { id: 'p4_accent', type: 'rect', x: 80, y: 100, width: 8, height: 120, name: '左侧色块', layer: 'design', props: { fill: '#37474F', stroke: '#37474F', strokeWidth: 0, radius: 4 } },
        { id: 'p4_title', type: 'text', x: 110, y: 100, width: 500, height: 56, name: '标题', layer: 'design', props: { content: '培训结业证书', fontSize: 38, fontFamily: 'PingFang SC, sans-serif', fontWeight: 'bold', color: '#263238', textAlign: 'left' } },
        { id: 'p4_sub', type: 'text', x: 110, y: 165, width: 500, height: 26, name: '英文副题', layer: 'design', props: { content: 'TRAINING COMPLETION CERTIFICATE', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', color: '#90A4AE', textAlign: 'left' } },
        { id: 'p4_body', type: 'variable-text', x: 110, y: 280, width: 760, height: 120, name: '正文', props: { template: '{{studentName}} 已完成 {{courseName}} 全部培训课程，考核合格，准予结业。', fontSize: 22, fontFamily: 'PingFang SC, sans-serif', color: '#455A64', lineHeight: 1.9 } },
        { id: 'p4_div', type: 'divider', x: 110, y: 460, width: 600, height: 0, name: '分割线', layer: 'design', props: { style: 'solid', color: '#ECEFF1', thickness: 2 } },
        { id: 'p4_no', type: 'variable-text', x: 110, y: 490, width: 400, height: 24, name: '证书编号', props: { template: 'CERT NO. {{certificateNo}}', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', color: '#90A4AE', textAlign: 'left' } },
        { id: 'p4_org', type: 'variable-text', x: 110, y: 640, width: 400, height: 30, name: '机构', props: { template: '{{orgName}}', fontSize: 18, fontFamily: 'PingFang SC, sans-serif', fontWeight: 'bold', color: '#37474F', textAlign: 'left' } },
        { id: 'p4_date', type: 'auto-field', x: 110, y: 680, width: 300, height: 26, name: '日期', props: { field: 'issueDate', format: 'yyyy-MM-dd', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', color: '#78909C', textAlign: 'left' } },
        { id: 'p4_qr', type: 'qrcode', x: 900, y: 560, width: 110, height: 110, name: '验证二维码', props: { dataTemplate: 'https://verify.example.com/{{certificateNo}}', label: 'VERIFY', labelFontSize: 9 } },
      ],
    },
  },

  // ── 5. 中式典雅（墨绿描金） ──
  {
    key: 'oriental',
    name: '中式典雅',
    description: '墨绿描金 · 纹样边框 · 国风',
    accent: '#1B5E20',
    canvas: {
      width: W, height: H, background: '#FDFBF3', version: 2,
      elements: [
        { id: 'p5_border', type: 'rect', x: 30, y: 30, width: 1063, height: 734, name: '外边框', layer: 'design', props: { fill: 'transparent', stroke: '#1B5E20', strokeWidth: 3, radius: 0 } },
        { id: 'p5_border2', type: 'rect', x: 44, y: 44, width: 1035, height: 706, name: '金内框', layer: 'design', props: { fill: 'transparent', stroke: '#B8963E', strokeWidth: 1, radius: 0 } },
        { id: 'p5_corner1', type: 'text', x: 52, y: 52, width: 40, height: 40, name: '角饰左上', layer: 'design', props: { content: '❖', fontSize: 22, fontFamily: 'serif', color: '#B8963E', textAlign: 'center' } },
        { id: 'p5_corner2', type: 'text', x: 1031, y: 52, width: 40, height: 40, name: '角饰右上', layer: 'design', props: { content: '❖', fontSize: 22, fontFamily: 'serif', color: '#B8963E', textAlign: 'center' } },
        { id: 'p5_corner3', type: 'text', x: 52, y: 700, width: 40, height: 40, name: '角饰左下', layer: 'design', props: { content: '❖', fontSize: 22, fontFamily: 'serif', color: '#B8963E', textAlign: 'center' } },
        { id: 'p5_corner4', type: 'text', x: 1031, y: 700, width: 40, height: 40, name: '角饰右下', layer: 'design', props: { content: '❖', fontSize: 22, fontFamily: 'serif', color: '#B8963E', textAlign: 'center' } },
        { id: 'p5_title', type: 'text', x: 361, y: 100, width: 400, height: 64, name: '标题', layer: 'design', props: { content: '结 业 证 书', fontSize: 44, fontFamily: 'KaiTi, STKaiti, serif', fontWeight: 'bold', color: '#1B5E20', textAlign: 'center' } },
        { id: 'p5_body', type: 'variable-text', x: 160, y: 260, width: 803, height: 130, name: '正文', props: { template: '兹有 {{studentName}} ，研修 {{courseName}} 课程，学业期满，考核合格，准予结业，特颁此证。', fontSize: 22, fontFamily: 'KaiTi, STKaiti, serif', color: '#3E2723', lineHeight: 2.0 } },
        { id: 'p5_org', type: 'variable-text', x: 160, y: 630, width: 400, height: 30, name: '颁证机构', props: { template: '{{orgName}}', fontSize: 18, fontFamily: 'KaiTi, STKaiti, serif', color: '#4E342E', textAlign: 'left' } },
        { id: 'p5_date', type: 'auto-field', x: 663, y: 630, width: 300, height: 30, name: '颁证日期', props: { field: 'issueDate', format: 'yyyy年MM月dd日', fontSize: 16, fontFamily: 'KaiTi, STKaiti, serif', color: '#5D4037', textAlign: 'right' } },
        { id: 'p5_seal', type: 'seal', x: 820, y: 500, width: 125, height: 125, name: '印章', props: { shape: 'circle', text: '培训认证专用章', subText: '★', color: '#C62828', fontSize: 12 } },
        { id: 'p5_no', type: 'variable-text', x: 160, y: 685, width: 400, height: 24, name: '证书编号', props: { template: '证书编号：{{certificateNo}}', fontSize: 12, fontFamily: 'KaiTi, STKaiti, serif', color: '#8D6E63', textAlign: 'left' } },
      ],
    },
  },
];

/** 按 key 查找预设 */
export function getPreset(key: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find(p => p.key === key);
}
