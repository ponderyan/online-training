#!/usr/bin/env python3
"""OCR 引擎 — RapidOCR(ONNX) 主引擎，Tesseract 降级兜底

用法：
  python3 ocr-pdf.py <输入PDF> [输出txt]        # 逐页 OCR 扫描版 PDF（兼容旧调用）
  python3 ocr-pdf.py image <输入图> [输出txt]    # 单张图片 OCR（png/jpg）

主引擎 RapidOCR（PaddleOCR 模型 ONNX 化，Apache 2.0，中文更准）：
  - 自带文本检测+识别，无需手写去偏斜/二值化预处理
  - 加载失败自动降级 Tesseract(chi_sim)，保证链路不崩
"""
import sys
import os
import time

# ── 引擎单例（每次进程内只初始化一次）──
_ENGINE = None


def get_engine():
    """懒加载 RapidOCR；失败返回 None（调用方降级 tesseract）"""
    global _ENGINE
    if _ENGINE is not None:
        return _ENGINE
    try:
        from rapidocr_onnxruntime import RapidOCR
        _ENGINE = RapidOCR()
    except Exception as e:
        print(f'⚠️ RapidOCR 加载失败: {e}，降级 Tesseract', file=sys.stderr)
        _ENGINE = None
    return _ENGINE


def ocr_image_rapid(img):
    """PIL 图片 → 文本行（RapidOCR）"""
    import numpy as np
    engine = get_engine()
    if engine is None:
        return None
    arr = np.array(img.convert('RGB'))
    result, _ = engine(arr)
    if not result:
        return ''
    lines = []
    for _box, text, _score in result:
        if text and text.strip():
            lines.append(text.strip())
    return '\n'.join(lines)


def ocr_image_tesseract(img, lang='chi_sim'):
    """PIL 图片 → 文本（Tesseract 降级）"""
    import pytesseract
    gray = img.convert('L')
    return pytesseract.image_to_string(gray, lang=lang)


def ocr_single_image(img):
    """统一入口：RapidOCR 优先，失败降级 tesseract"""
    from PIL import Image
    if not isinstance(img, Image.Image):
        img = Image.open(img)
    text = ocr_image_rapid(img)
    if text is None:  # 引擎不可用 → 降级
        text = ocr_image_tesseract(img)
    return text


def ocr_pdf(pdf_path, output_path, dpi=200):
    """逐页 OCR 扫描版 PDF，输出带分页标记的纯文本"""
    import fitz
    from PIL import Image

    doc = fitz.open(pdf_path)
    total = len(doc)
    print(f'📄 共 {total} 页，开始 OCR（RapidOCR）...')

    all_text = []
    start = time.time()

    for i in range(total):
        page = doc[i]
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)

        text = ocr_single_image(img)

        if text and text.strip():
            all_text.append(f'\n\n=== 第 {i + 1} 页 ===\n\n{text.strip()}')

        if (i + 1) % 10 == 0 or i == total - 1:
            elapsed = time.time() - start
            speed = (i + 1) / elapsed if elapsed > 0 else 0
            print(f'  ⏳ {i + 1}/{total} 页 ({speed:.1f} 页/秒)', file=sys.stderr)

    result = ''.join(all_text)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)

    elapsed = time.time() - start
    print(f'\n✅ OCR 完成！{total} 页 → {len(result)} 字符，耗时 {elapsed:.0f} 秒', file=sys.stderr)
    return result


def ocr_image_file(image_path, output_path):
    """单张图片 OCR，输出纯文本"""
    from PIL import Image
    print(f'🖼️  图片 OCR: {image_path}')
    text = ocr_single_image(Image.open(image_path))
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'\n✅ OCR 完成 → {len(text)} 字符', file=sys.stderr)
    return text


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print('用法: python3 ocr-pdf.py <输入PDF> [输出txt]  |  python3 ocr-pdf.py image <输入图> [输出txt]')
        sys.exit(1)

    mode = 'pdf'
    if args[0] == 'image':
        mode = 'image'
        args = args[1:]

    if len(args) < 1:
        print('用法: python3 ocr-pdf.py [image] <输入文件> [输出txt]')
        sys.exit(1)

    input_path = args[0]
    output_path = args[1] if len(args) > 1 else (
        os.path.splitext(input_path)[0] + '_ocr.txt'
    )

    if not os.path.exists(input_path):
        print(f'❌ 文件不存在: {input_path}')
        sys.exit(1)

    try:
        if mode == 'image':
            ocr_image_file(input_path, output_path)
        else:
            ocr_pdf(input_path, output_path)
    except Exception as e:
        print(f'❌ OCR 失败: {e}')
        sys.exit(1)
