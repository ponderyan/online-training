# ── Build stage ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable pnpm
# ★ 2026-08-21：国内镜像 registry（腾讯云/阿里云到 npmjs 不稳，大包反复失败）
#   ONNXRUNTIME_NODE_INSTALL=skip —— CPU 二进制已捆绑在 npm 包内，仅跳过从 NuGet 拉 CUDA EP（腾讯云访问超时）
ENV npm_config_registry=https://registry.npmmirror.com \
    ONNXRUNTIME_NODE_INSTALL=skip
# pnpm-workspace.yaml 必须带上：pnpm 11 只从它读 allowBuilds，缺失会 ERR_PNPM_IGNORED_BUILDS
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm store cache mount：跨构建复用下载，避免腾讯云反复从 npmjs 拉 654 个包
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

# ── Production stage ──
# ★ 2026-08-21：基镜固定 glibc（bookworm）——onnxruntime-node（本地嵌入）无 musl 预编译，
#   alpine 会使语义检索静默降级为关键词检索；验证脚本 scripts/docker/check-alpine-compat.sh
FROM node:22-bookworm-slim
WORKDIR /app
# 跳过 puppeteer 自带 Chrome 下载（prod 安装阶段也生效），证书渲染改用系统 chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# 文档解析/OCR/证书 PDF 运行依赖：
#   python3+pip → RapidOCR 主引擎（glibc 轮子齐全）
#   tesseract-ocr(chi_sim)+catdoc → OCR 降级引擎
#   chromium+fonts-noto-cjk → puppeteer 证书 PDF 渲染 + 中文字体
# ★ 2026-08-21：apt 源切阿里云镜像（腾讯云到 deb.debian.org 每个包 10-30s，30 分钟没装完）
RUN corepack enable pnpm && \
    sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g; s|http://security.debian.org|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list 2>/dev/null; \
    apt-get update && apt-get install -y --no-install-recommends \
    curl python3 python3-pip tesseract-ocr tesseract-ocr-chi-sim catdoc \
    chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
# OCR 主引擎 RapidOCR（bookworm glibc 环境轮子完整，不再需要降级兜底，仍保留容错）
COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r scripts/requirements.txt || echo "⚠️ RapidOCR 安装失败，将使用 Tesseract 降级"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV npm_config_registry=https://registry.npmmirror.com \
    ONNXRUNTIME_NODE_INSTALL=skip
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY scripts ./scripts
RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
