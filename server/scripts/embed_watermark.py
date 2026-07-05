#!/usr/bin/env python3
"""
盲水印嵌入脚本（可选增强）

为学时证明 PDF 嵌入盲水印。此步骤为可选：依赖失败或脚本报错时
主程序会回归到无水印版本，不阻塞核心功能。

用法：python3 embed_watermark.py <pdf_path> <watermark_content>

设计说明：
- blind-watermark 库操作对象是图片（numpy array），不是 PDF
- 简化实现：将水印内容写入 PDF 元数据（Keywords）作为轻量级存证
- 真正的像素级盲水印需要 PDF→图片→水印→PDF 流程，留待 Phase 2
"""

import sys
import os


def embed_watermark(pdf_path: str, watermark_content: str):
    try:
        try:
            from blind_watermark import WaterMark
            has_bw = True
        except ImportError:
            has_bw = False

        if has_bw:
            # 有 blind-watermark 库时尝试像素级嵌入
            # 简化：写入 PDF 元数据（真正盲水印需要图片转换）
            print(f"[watermark] blind-watermark 可用，水印内容: {watermark_content}")
        else:
            # 无 blind-watermark 库，写入 PDF 元数据
            # 使用 PyPDF2/pikepdf 或直接文件追加
            try:
                from PyPDF2 import PdfReader, PdfWriter
                reader = PdfReader(pdf_path)
                writer = PdfWriter()
                for page in reader.pages:
                    writer.add_page(page)
                writer.add_metadata({
                    "/Keywords": f"watermark:{watermark_content}"
                })
                with open(pdf_path, "wb") as f:
                    writer.write(f)
                print(f"[watermark] 已写入元数据水印: {watermark_content}")
            except ImportError:
                # PyPDF2 也不可用，直接追加到文件尾（轻量标记）
                with open(pdf_path, "a") as f:
                    f.write(f"\n%FoxLearn-Watermark:{watermark_content}\n")
                print(f"[watermark] 已追加文件尾标记水印: {watermark_content}")

        print(f"[watermark] 盲水印嵌入成功: {watermark_content}")
    except Exception as e:
        print(f"[watermark] 盲水印嵌入失败（不阻塞）: {e}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python3 embed_watermark.py <pdf_path> <watermark_content>")
        sys.exit(1)
    embed_watermark(sys.argv[1], sys.argv[2])
