# ── Build stage ──
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

# ── Production stage ──
# ★ 2026-08-21：基镜固定 glibc（bookworm）——onnxruntime-node（本地嵌入）无 musl 预编译，
#   alpine 会使语义检索静默降级为关键词检索；验证脚本 scripts/docker/check-alpine-compat.sh
FROM node:20-bookworm-slim
WORKDIR /app
# 跳过 puppeteer 自带 Chrome 下载（prod 安装阶段也生效），证书渲染改用系统 chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# 文档解析/OCR/证书 PDF 运行依赖：
#   python3+pip → RapidOCR 主引擎（glibc 轮子齐全）
#   tesseract-ocr(chi_sim)+catdoc → OCR 降级引擎
#   chromium+fonts-noto-cjk → puppeteer 证书 PDF 渲染 + 中文字体
RUN corepack enable pnpm && apt-get update && apt-get install -y --no-install-recommends \
    curl python3 python3-pip tesseract-ocr tesseract-ocr-chi-sim catdoc \
    chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
# OCR 主引擎 RapidOCR（bookworm glibc 环境轮子完整，不再需要降级兜底，仍保留容错）
COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r scripts/requirements.txt || echo "⚠️ RapidOCR 安装失败，将使用 Tesseract 降级"
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY scripts ./scripts
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

# ── Production stage ──
FROM node:20-alpine
WORKDIR /app
# 文档解析/OCR 运行依赖：Python3 + Tesseract(chi_sim) + catdoc
RUN corepack enable pnpm && apk add --no-cache curl python3 py3-pip tesseract-ocr tesseract-ocr-chi-sim catdoc
# OCR 主引擎 RapidOCR（尽力安装；alpine/musl 若无轮子则跳过，运行时自动降级 Tesseract）
COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r scripts/requirements.txt 2>/dev/null || echo "⚠️ RapidOCR 安装失败，将使用 Tesseract 降级"
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY scripts ./scripts
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
