#!/usr/bin/env python3
"""OCR 扫描版 PDF — 使用 PyMuPDF + Tesseract，逐页识别输出文本"""
import sys, os, json, tempfile, time
import fitz
from PIL import Image
import pytesseract

def ocr_pdf(pdf_path: str, output_path: str, dpi: int = 200, lang: str = 'chi_sim'):
    doc = fitz.open(pdf_path)
    total = len(doc)
    print(f'📄 共 {total} 页，开始 OCR...')

    all_text = []
    start = time.time()

    for i in range(total):
        page = doc[i]
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)

        # 转为灰度提高 OCR 准确率
        gray = img.convert('L')

        text = pytesseract.image_to_string(gray, lang=lang)

        # 过滤短文本（空白页）
        if text.strip():
            all_text.append(f'\n\n=== 第 {i+1} 页 ===\n\n{text}')

        if (i + 1) % 10 == 0 or i == total - 1:
            elapsed = time.time() - start
            speed = (i + 1) / elapsed if elapsed > 0 else 0
            print(f'  ⏳ {i+1}/{total} 页 ({speed:.1f} 页/秒)')

    result = ''.join(all_text)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)

    elapsed = time.time() - start
    print(f'\n✅ OCR 完成！{total} 页 → {len(result)} 字符，耗时 {elapsed:.0f} 秒')
    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python3 ocr-pdf.py <输入PDF路径> [输出文本路径]')
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else pdf_path.replace('.pdf', '_ocr.txt')

    if not os.path.exists(pdf_path):
        print(f'❌ 文件不存在: {pdf_path}')
        sys.exit(1)

    ocr_pdf(pdf_path, output_path)
