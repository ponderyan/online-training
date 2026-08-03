#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# FoxLearn Demo 一键部署脚本（腾讯云 CVM / 任意 Ubuntu 20.04+ 服务器）
# 用法：
#   方式1（服务器上直接跑）：把整个仓库目录上传后执行  bash deploy/setup-demo.sh
#   方式2（本地远程部署）：  bash deploy/setup-demo.sh --remote root@<服务器IP>
# 最低配置建议：2 核 4G 内存、40G 磁盘（MySQL + NestJS + Next.js + Nginx）
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

log() { echo -e "\033[1;32m[deploy]\033[0m $*"; }

# ── 0. 远程模式：把目录 rsync 到目标机并在目标机执行本脚本 ──
if [[ "${1:-}" == "--remote" ]]; then
  TARGET="${2:?用法: setup-demo.sh --remote root@IP}"
  log "同步代码到 $TARGET:/opt/foxlearn ..."
  ssh "$TARGET" "mkdir -p /opt/foxlearn"
  rsync -az --delete --exclude node_modules --exclude .next --exclude dist \
    --exclude .git --exclude uploads "$PROJECT_DIR/" "$TARGET:/opt/foxlearn/"
  log "远程执行部署 ..."
  ssh "$TARGET" "cd /opt/foxlearn && bash deploy/setup-demo.sh"
  exit 0
fi

# ── 1. 安装 Docker（已安装则跳过）──
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker ..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi
if ! docker compose version >/dev/null 2>&1; then
  log "安装 docker compose 插件 ..."
  apt-get install -y -qq docker-compose-plugin
fi
log "Docker: $(docker --version)"

# ── 2. 生成 .env ──
if [[ ! -f .env ]]; then
  log "生成 .env ..."
  cp .env.demo .env
  # 自动探测公网 IP（腾讯云 metadata）
  PUB_IP="$(curl -s --max-time 3 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 || true)"
  [[ -z "$PUB_IP" ]] && PUB_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  sed -i "s|YOUR_SERVER_IP|${PUB_IP:-127.0.0.1}|" .env
  # 随机 JWT 密钥
  JWT="$(head -c 32 /dev/urandom | base64 | tr -d '=+/' | head -c 32)"
  sed -i "s|CHANGE_ME_RANDOM_32|${JWT}|" .env
  log "访问地址: $(grep '^SITE_URL' .env | cut -d= -f2)"
else
  log ".env 已存在，跳过生成"
fi

# ── 3. 构建并启动 ──
log "构建并启动容器（首次约 5-10 分钟）..."
docker compose up -d --build

# ── 4. 等待后端健康 ──
log "等待后端健康检查 ..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then break; fi
  sleep 5
done
curl -sf http://localhost:3001/api/health >/dev/null || { echo "❌ 后端未就绪，查看日志: docker compose logs server"; exit 1; }
log "后端已就绪"

# ── 5. 初始化种子数据（含 8 角色账号 + 演示考试 + 证书）──
log "初始化种子数据 ..."
docker compose run --rm seed
log "种子数据完成"

# ── 6. 完成 ──
SITE="$(grep '^SITE_URL' .env | cut -d= -f2)"
PW="$(grep '^DEMO_PASSWORD' .env | cut -d= -f2)"
echo ""
echo "══════════════════════════════════════════════"
echo "✅ FoxLearn Demo 部署完成！"
echo "   访问地址: $SITE"
echo "   超管账号: admin / $PW"
echo "   全部账号见根目录 DEMO.md"
echo "══════════════════════════════════════════════"
