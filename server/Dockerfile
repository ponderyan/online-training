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
