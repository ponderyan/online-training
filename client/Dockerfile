# ── Build stage ──
# ★ 2026-08-21：与 server 统一 bookworm-slim（纯 JS 应用 alpine 亦可，统一基镜减少排查变量）
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable pnpm
# ★ 2026-08-21：国内镜像 registry（规避腾讯云到 npmjs 下载失败）
ENV npm_config_registry=https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_BASE=http://localhost
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN pnpm run build

# ── Production stage (standalone) ──
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
