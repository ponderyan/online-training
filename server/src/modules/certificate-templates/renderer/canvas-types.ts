/**
 * 证书模板画布 JSON Schema 定义
 * ─────────────────────────────────────────
 * 这是模板系统的单一数据源（Single Source of Truth）。
 * 前端编辑器、前端预览、后端 PDF 渲染均基于此结构。
 *
 * 坐标单位：px（96 DPI）。A4 竖版 ≈ 794×1123，横版 ≈ 1123×794。
 */

/** 画布尺寸预设 */
export const PAGE_PRESETS = {
  A4_PORTRAIT: { width: 794, height: 1123, label: 'A4 竖版' },
  A4_LANDSCAPE: { width: 1123, height: 794, label: 'A4 横版' },
  A5_PORTRAIT: { width: 559, height: 794, label: 'A5 竖版' },
  A5_LANDSCAPE: { width: 794, height: 559, label: 'A5 横版' },
} as const;

export type ElementType =
  | 'text'
  | 'variable-text'
  | 'image'
  | 'table'
  | 'qrcode'
  | 'seal'
  | 'barcode'
  | 'divider'
  | 'auto-field'
  | 'rect';

/** 渲染模式 */
export type RenderMode = 'preview' | 'print' | 'pdf';

/** 元素图层归属 */
export type ElementLayer = 'design' | 'dynamic';

/** 所有元素共享的基础属性 */
export interface BaseElement {
  id: string;
  type: ElementType;
  /** 图层显示名 */
  name?: string;
  /** 位置（相对画布左上角，px） */
  x: number;
  y: number;
  /** 尺寸（px） */
  width: number;
  height: number;
  /** 旋转角度（deg，顺时针） */
  rotation?: number;
  /** 不透明度 0-1 */
  opacity?: number;
  /** 锁定后不可编辑 */
  locked?: boolean;
  /** 隐藏后不渲染 */
  hidden?: boolean;
  /** 图层归属：design=底版装饰层（打印时跳过），dynamic=动态打印层（默认） */
  layer?: ElementLayer;
}

/** 静态文本 */
export interface TextElement extends BaseElement {
  type: 'text';
  props: {
    content: string;
    fontSize: number;
    fontFamily: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    color: string;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    textDecoration?: 'none' | 'underline';
  };
}

/** 变量文本：支持 {{var}} 插值 */
export interface VariableTextElement extends BaseElement {
  type: 'variable-text';
  props: {
    /** 含 {{studentName}} 等占位符的模板字符串 */
    template: string;
    fontSize: number;
    fontFamily: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    color: string;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
  };
}

/** 图片（Logo/背景/装饰） */
export interface ImageElement extends BaseElement {
  type: 'image';
  props: {
    src: string; // URL 或 data URL
    fit?: 'contain' | 'cover' | 'fill';
    radius?: number; // 圆角
  };
}

/** 表格（学时明细等） */
export interface TableElement extends BaseElement {
  type: 'table';
  props: {
    /** 数据源变量名（如 hoursDetail），或静态行 */
    dataVariable?: string;
    columns: { key: string; label: string; align?: 'left' | 'center' | 'right'; width?: number }[];
    fontSize: number;
    fontFamily: string;
    color: string;
    headerBg?: string;
    headerColor?: string;
    borderColor?: string;
    showTotal?: boolean;
    totalLabel?: string;
    totalKey?: string;
  };
}

/** 二维码 */
export interface QrCodeElement extends BaseElement {
  type: 'qrcode';
  props: {
    /** 数据模板，如 https://x.cn/verify/{{certificateNo}} */
    dataTemplate: string;
    label?: string;
    labelFontSize?: number;
    color?: string;
  };
}

/** 印章 */
export interface SealElement extends BaseElement {
  type: 'seal';
  props: {
    shape?: 'circle' | 'ellipse';
    text: string; // 环形主文字
    subText?: string; // 中心横排文字
    color?: string;
    fontSize?: number;
    /** 机构印章图片 URL/dataURL，支持 {{var}} 插值（如 {{orgSealDataUrl}}）。为空则用内置 SVG 环形文字 */
    src?: string;
  };
}

/** 条形码 */
export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  props: {
    /** 数据模板，如 {{certificateNo}} */
    dataTemplate: string;
    format?: 'CODE128';
    color?: string;
    showText?: boolean;
  };
}

/** 分割线 */
export interface DividerElement extends BaseElement {
  type: 'divider';
  props: {
    style?: 'solid' | 'dashed' | 'dotted' | 'double';
    color: string;
    thickness: number;
  };
}

/** 自动字段（日期/编号，自动格式化） */
export interface AutoFieldElement extends BaseElement {
  type: 'auto-field';
  props: {
    field: 'issueDate' | 'certificateNo' | 'currentPage';
    format?: string; // 日期格式，如 yyyy年MM月dd日
    prefix?: string;
    suffix?: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

/** 矩形/边框 */
export interface RectElement extends BaseElement {
  type: 'rect';
  props: {
    fill?: string; // 填充色，'transparent' 表示无
    stroke?: string; // 边框色
    strokeWidth?: number;
    radius?: number; // 圆角
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  };
}

export type CanvasElement =
  | TextElement
  | VariableTextElement
  | ImageElement
  | TableElement
  | QrCodeElement
  | SealElement
  | BarcodeElement
  | DividerElement
  | AutoFieldElement
  | RectElement;

/** 画布定义 */
export interface CanvasDef {
  /** 模板格式版本（用于未来升级迁移），当前版本 = 2 */
  version?: number;
  width: number;
  height: number;
  /** 背景色 */
  background: string;
  /** 背景图（可选）：URL 或 data URL */
  backgroundImage?: string;
  /** 背景图适配模式 */
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  /** 元素列表（数组顺序即图层顺序，越靠后越上层） */
  elements: CanvasElement[];
}

/** 模板渲染时注入的变量数据 */
export interface TemplateData {
  studentName?: string;
  courseName?: string;
  certificateNo?: string;
  issueDate?: string;
  orgName?: string;
  /** 身份证号（完整） */
  idCard?: string;
  /** 身份证号（脱敏，如 110***1234） */
  idCardMasked?: string;
  totalHours?: number;
  hoursDetail?: Array<Record<string, any>>;
  startDate?: string;
  endDate?: string;
  verificationCode?: string;
  qrDataUrl?: string; // 预生成的 QR data URL
  // ── 机构配置注入（2026-08-13）──
  /** 签发单位（= certIssuerName || org.name），旧模板 {{orgName}} 也用它 */
  issuerName?: string;
  /** 底部说明文字（certFooterText） */
  footerText?: string;
  /** 机构 Logo dataURL（toDataUrl 产物，base64） */
  orgLogoDataUrl?: string;
  /** 机构印章 dataURL；机构勾选 useFoxLearnSeal 时为 undefined（seal 元素回退内置环形章） */
  orgSealDataUrl?: string;
  /** 培训班名称（学时专用） */
  programName?: string;
  /** 学时防伪指纹 */
  sealHash?: string;
  [key: string]: any;
}
