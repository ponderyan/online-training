#!/bin/bash
# FoxLearn Docker 部署数据库备份脚本（2026-08-11）
# 在 compose 所在目录执行，备份容器内 MySQL 到宿主机 BACKUP_DIR，带轮转
# crontab -e → 0 2 * * * /path/to/online-training/scripts/backup-db-docker.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_CONTAINER="${DB_CONTAINER:-foxlearn-db}"
DB_NAME="${DB_NAME:-online_training}"
DB_USER="${DB_USER:-training_user}"
# 密码从项目 .env 读取（compose 同源），可用 DB_PASSWORD 覆盖
if [ -z "${DB_PASSWORD:-}" ] && [ -f "$PROJECT_DIR/.env" ]; then
  DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$PROJECT_DIR/.env" | head -1 | cut -d= -f2-)
fi
DB_PASSWORD="${DB_PASSWORD:-training_2024}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILEPATH="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "[$(date)] 开始备份容器 $DB_CONTAINER 的 $DB_NAME → $FILEPATH"
docker exec "$DB_CONTAINER" mysqldump -u "$DB_USER" -p"$DB_PASSWORD" \
  --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces "$DB_NAME" \
  | gzip > "$FILEPATH"
SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "[$(date)] 备份完成：$FILEPATH ($SIZE)"
# 轮转：删除超期备份
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] 已清理 ${RETENTION_DAYS} 天前的旧备份"
