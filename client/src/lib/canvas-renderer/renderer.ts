/**
 * 画布渲染器（单一渲染源 Single Source of Truth）
 * ─────────────────────────────────────────────
 * 纯函数：CanvasDef + TemplateData → HTML 字符串。
 * 无框架依赖，可同时运行于 Node（后端 PDF）与浏览器（前端预览/编辑）。
 *
 * 前端编辑器、前端预览、后端 Puppeteer PDF 均使用此渲染器的输出，
 * 从结构上保证「所见即所得」——不存在第二份渲染逻辑。
 */

import type {
  CanvasDef,
  CanvasElement,
  TemplateData,
  RenderMode,
  TextElement,
  VariableTextElement,
  ImageElement,
  RectElement,
  DividerElement,
  AutoFieldElement,
  TableElement,
  QrCodeElement,
  SealElement,
  BarcodeElement,
} from './types';

/** HTML 转义，防止 XSS 与排版错乱 */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 插值 {{var}}：用 data 中的值替换，值会被 HTML 转义 */
export function interpolate(template: string, data: TemplateData): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = data[key];
    return escapeHtml(v == null ? '' : v);
  });
}

/** 日期格式化 */
function formatDate(value: unknown, format = 'yyyy年MM月dd日'): string {
  if (!value) return '';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return escapeHtml(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return format
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/dd/g, pad(d.getDate()));
}

/** 通用元素外层定位样式 */
function positionStyle(el: CanvasElement): string {
  const s: string[] = [
    'position:absolute',
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.width}px`,
    `height:${el.height}px`,
    'box-sizing:border-box',
  ];
  if (el.rotation) s.push(`transform:rotate(${el.rotation}deg)`);
  if (el.opacity != null && el.opacity !== 1) s.push(`opacity:${el.opacity}`);
  return s.join(';');
}

/** 文本类公共样式 */
function textStyle(p: {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontStyle?: string;
  color: string;
  textAlign?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
}): string {
  return [
    `font-size:${p.fontSize}px`,
    `font-family:${p.fontFamily}`,
    `font-weight:${p.fontWeight || 'normal'}`,
    `font-style:${p.fontStyle || 'normal'}`,
    `color:${p.color}`,
    `text-align:${p.textAlign || 'left'}`,
    `line-height:${p.lineHeight || 1.5}`,
    p.letterSpacing ? `letter-spacing:${p.letterSpacing}px` : '',
    p.textDecoration && p.textDecoration !== 'none' ? `text-decoration:${p.textDecoration}` : '',
    'margin:0',
    'word-break:break-word',
  ].filter(Boolean).join(';');
}

function renderText(el: TextElement): string {
  return `<div style="${positionStyle(el)};overflow:hidden"><div style="${textStyle(el.props)}">${escapeHtml(el.props.content)}</div></div>`;
}

function renderVariableText(el: VariableTextElement, data: TemplateData): string {
  const html = interpolate(el.props.template, data);
  return `<div style="${positionStyle(el)};overflow:hidden"><div style="${textStyle(el.props)}">${html}</div></div>`;
}

function renderImage(el: ImageElement, data: TemplateData): string {
  // ★ src 支持 {{var}} 插值（如 {{orgLogoDataUrl}}）。interpolate 已转义替换值；
  // 注：escapeHtml 只转义 & < > " '，与 base64 字母表 {A-Za-z0-9+/=} 不相交，dataURL 透传安全。
  const src = interpolate(el.props.src, data);
  if (!src) return ''; // 变量未注入（如机构未配 logo）时不渲染，避免破图
  const fit = el.props.fit || 'contain';
  const radius = el.props.radius ? `border-radius:${el.props.radius}px` : '';
  const objectFit = fit === 'fill' ? 'fill' : fit === 'cover' ? 'cover' : 'contain';
  return `<div style="${positionStyle(el)};overflow:hidden;${radius}"><img src="${src}" style="width:100%;height:100%;object-fit:${objectFit};display:block;${radius}" alt="" /></div>`;
}

function renderRect(el: RectElement): string {
  const p = el.props;
  const s: string[] = [positionStyle(el)];
  if (p.fill && p.fill !== 'transparent') s.push(`background:${p.fill}`);
  if (p.stroke && p.strokeWidth) {
    s.push(`border:${p.strokeWidth}px ${p.borderStyle || 'solid'} ${p.stroke}`);
  }
  if (p.radius) s.push(`border-radius:${p.radius}px`);
  return `<div style="${s.join(';')}"></div>`;
}

function renderDivider(el: DividerElement): string {
  const p = el.props;
  const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:0;border-top:${p.thickness}px ${p.style || 'solid'} ${p.color}`;
  return `<div style="${style}"></div>`;
}

function renderAutoField(el: AutoFieldElement, data: TemplateData): string {
  const p = el.props;
  let value = '';
  if (p.field === 'issueDate') value = formatDate(data.issueDate, p.format);
  else if (p.field === 'certificateNo') value = escapeHtml(data.certificateNo || '');
  const content = `${escapeHtml(p.prefix || '')}${value}${escapeHtml(p.suffix || '')}`;
  return `<div style="${positionStyle(el)};overflow:hidden"><div style="${textStyle(p)}">${content}</div></div>`;
}

function renderTable(el: TableElement, data: TemplateData): string {
  const p = el.props;
  const rows: Array<Record<string, any>> = p.dataVariable ? (data[p.dataVariable] as any[]) || [] : [];
  const border = `1px solid ${p.borderColor || '#999'}`;
  let html = `<div style="${positionStyle(el)};overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:${p.fontSize}px;font-family:${p.fontFamily};color:${p.color}">`;
  html += '<thead><tr>';
  for (const col of p.columns) {
    html += `<th style="border:${border};padding:4px 8px;text-align:${col.align || 'left'};background:${p.headerBg || '#f0f0f0'};color:${p.headerColor || p.color}">${escapeHtml(col.label)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (const col of p.columns) {
      html += `<td style="border:${border};padding:4px 8px;text-align:${col.align || 'left'}">${escapeHtml(row[col.key])}</td>`;
    }
    html += '</tr>';
  }
  if (p.showTotal) {
    const total = rows.reduce((sum, r) => sum + (Number(r[p.totalKey || 'hours']) || 0), 0);
    html += `<tr><td style="border:${border};padding:4px 8px;font-weight:bold">${escapeHtml(p.totalLabel || '合计')}</td><td style="border:${border};padding:4px 8px;font-weight:bold;text-align:right">${total}</td></tr>`;
  }
  html += '</tbody></table></div>';
  return html;
}

/** 二维码渲染：使用 TemplateData.qrDataUrl 或显示占位 */
function renderQrCode(el: CanvasElement & { type: 'qrcode' }, data: TemplateData): string {
  const p = el.props as any;
  const dataUrl = data.qrDataUrl || '';
  const label = p.label ? `<div style="text-align:center;font-size:${p.labelFontSize || 10}px;color:#666;margin-top:2px">${escapeHtml(p.label)}</div>` : '';
  if (dataUrl) {
    return `<div style="${positionStyle(el)};display:flex;flex-direction:column;align-items:center;justify-content:center"><img src="${escapeHtml(dataUrl)}" style="width:100%;height:100%;object-fit:contain" alt="QR" />${label}</div>`;
  }
  // 占位：显示数据模板
  const dataText = interpolate(p.dataTemplate || '', data);
  return `<div style="${positionStyle(el)};border:1px dashed #999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fafafa"><svg width="60%" height="60%" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="none" stroke="#999" stroke-width="2"/><rect x="20" y="20" width="20" height="20" fill="#999"/><rect x="60" y="20" width="20" height="20" fill="#999"/><rect x="20" y="60" width="20" height="20" fill="#999"/><rect x="50" y="50" width="10" height="10" fill="#999"/><rect x="70" y="60" width="10" height="10" fill="#999"/></svg><div style="font-size:9px;color:#999;margin-top:2px">QR</div>${label}</div>`;
}

/** 印章渲染：纯 SVG 环形文字 */
function renderSeal(el: CanvasElement & { type: 'seal' }, data: TemplateData): string {
  const p = el.props as any;
  // ★ seal 支持可选 props.src（URL/dataURL，支持 {{var}} 插值，如 {{orgSealDataUrl}}）。
  //   有 src 时渲染机构印章整图；为空（未配置）回退内置 SVG 环形文字。
  const srcVal = p.src ? interpolate(p.src, data) : '';
  if (srcVal) {
    return `<div style="${positionStyle(el)}"><img src="${srcVal}" style="width:100%;height:100%;object-fit:contain" alt="seal" /></div>`;
  }
  const color = p.color || '#d32f2f';
  const text = p.text || '';
  const subText = p.subText || '';
  const fontSize = p.fontSize || 14;
  const cx = el.width / 2;
  const cy = el.height / 2;
  const r = Math.min(cx, cy) - 4;
  // 环形文字路径
  const chars = text.split('');
  const angleStep = chars.length > 0 ? (Math.PI * 1.4) / chars.length : 0;
  const startAngle = -Math.PI * 0.7;
  let textElements = '';
  for (let i = 0; i < chars.length; i++) {
    const angle = startAngle + i * angleStep;
    const x = cx + (r - 12) * Math.cos(angle);
    const y = cy + (r - 12) * Math.sin(angle);
    const rot = (angle * 180) / Math.PI + 90;
    textElements += `<text x="${x}" y="${y}" transform="rotate(${rot},${x},${y})" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-family="SimSun,serif">${escapeHtml(chars[i])}</text>`;
  }
  const subTextEl = subText ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${fontSize - 2}" fill="${color}" font-family="SimSun,serif">${escapeHtml(subText)}</text>` : '';
  const star = `<polygon points="${cx},${cy-8} ${cx+3},${cy-2} ${cx+8},${cy-2} ${cx+4},${cy+2} ${cx+6},${cy+8} ${cx},${cy+4} ${cx-6},${cy+8} ${cx-4},${cy+2} ${cx-8},${cy-2} ${cx-3},${cy-2}" fill="${color}"/>`;
  return `<div style="${positionStyle(el)}"><svg width="${el.width}" height="${el.height}" viewBox="0 0 ${el.width} ${el.height}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="3"/>${textElements}${star}${subTextEl}</svg></div>`;
}

/** 条形码渲染：占位 SVG（实际发证时替换为真实条码图） */
function renderBarcode(el: CanvasElement & { type: 'barcode' }, data: TemplateData): string {
  const p = el.props as any;
  const dataText = interpolate(p.dataTemplate || '', data);
  const color = p.color || '#000';
  // 简易 Code128 视觉占位（竖线条纹）
  let bars = '';
  const barWidth = el.width / 40;
  for (let i = 0; i < 40; i++) {
    const h = (i % 3 === 0) ? el.height * 0.8 : el.height * 0.6;
    if (i % 2 === 0) bars += `<rect x="${i * barWidth}" y="${(el.height - h) / 2}" width="${barWidth * 0.7}" height="${h}" fill="${color}"/>`;
  }
  const textEl = p.showText !== false ? `<text x="${el.width/2}" y="${el.height - 2}" text-anchor="middle" font-size="10" fill="${color}">${escapeHtml(dataText)}</text>` : '';
  return `<div style="${positionStyle(el)}"><svg width="${el.width}" height="${el.height}" viewBox="0 0 ${el.width} ${el.height}">${bars}${textEl}</svg></div>`;
}

/** 占位渲染（未实现的类型） */
function renderPlaceholder(el: CanvasElement): string {
  return `<div style="${positionStyle(el)};border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;background:#fafafa">${el.type}</div>`;
}

/** 渲染单个元素 */
export function renderElement(el: CanvasElement, data: TemplateData): string {
  if (el.hidden) return '';
  switch (el.type) {
    case 'text': return renderText(el);
    case 'variable-text': return renderVariableText(el, data);
    case 'image': return renderImage(el, data);
    case 'rect': return renderRect(el);
    case 'divider': return renderDivider(el);
    case 'auto-field': return renderAutoField(el, data);
    case 'table': return renderTable(el, data);
    case 'qrcode': return renderQrCode(el as any, data);
    case 'seal': return renderSeal(el as any, data);
    case 'barcode': return renderBarcode(el as any, data);
    default: return renderPlaceholder(el);
  }
}

/**
 * 渲染整个画布为 HTML 片段（绝对定位容器）。
 * @param canvas 画布定义
 * @param data 变量数据
 * @param opts.scale 缩放比例（前端编辑器适配屏幕用，PDF 用 1）
 * @param opts.mode 渲染模式：preview=全部 | print=仅dynamic层 | pdf=全部
 */
export function renderCanvasToHtml(
  canvas: CanvasDef,
  data: TemplateData = {},
  opts: { scale?: number; mode?: RenderMode } = {},
): string {
  const scale = opts.scale ?? 1;
  const mode = opts.mode ?? 'preview';
  const bg = canvas.background || '#ffffff';
  const bgFit = canvas.backgroundImageFit || 'cover';
  // print 模式不渲染底版背景图（已预印在纸张上）
  const showBgImage = mode !== 'print' && !!canvas.backgroundImage;
  const bgImage = showBgImage
    ? `background-image:url('${escapeHtml(canvas.backgroundImage!)}');background-size:${bgFit};background-position:center;background-repeat:no-repeat`
    : '';
  const transform = scale !== 1 ? `transform:scale(${scale});transform-origin:top left;` : '';

  // print 模式：仅渲染 layer !== 'design' 的元素
  const elements = mode === 'print'
    ? canvas.elements.filter(el => el.layer !== 'design')
    : canvas.elements;
  const elementsHtml = elements.map((el) => renderElement(el, data)).join('\n');

  return `<div class="cert-canvas" style="position:relative;width:${canvas.width}px;height:${canvas.height}px;background:${bg};${bgImage};${transform}overflow:hidden;margin:0 auto">
${elementsHtml}
</div>`;
}

/** 渲染为完整 HTML 文档（Puppeteer PDF 用，含字体与重置样式） */
export function renderCanvasToDocument(canvas: CanvasDef, data: TemplateData = {}, opts: { mode?: RenderMode } = {}): string {
  const body = renderCanvasToHtml(canvas, data, { scale: 1, mode: opts.mode });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${canvas.width}px; height:${canvas.height}px; }
  body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  img { -webkit-user-drag:none; }
</style>
</head>
<body>${body}</body>
</html>`;
}
