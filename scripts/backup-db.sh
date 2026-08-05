#!/bin/bash
# FoxLearn 数据库自动备份脚本
# crontab -e → 0 2 * * * /path/to/backup-db.sh
set -euo pipefail
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-online_training}"
# 优先从 server/.env 的 DATABASE_URL 解析凭据（可用 DB_USER/DB_PASSWORD 覆盖）
if [ -f "$(dirname "$0")/../server/.env" ]; then
  _creds=$(python3 -c "
import re
m = re.search(r'DATABASE_URL=\"?mysql://([^:]+):([^@\"]+)@', open('$(dirname "$0")/../server/.env').read())
print(m.group(1), m.group(2)) if m else None" 2>/dev/null)
  [ -n "$_creds" ] && { DB_USER="${DB_USER:-${_creds%% *}}"; DB_PASSWORD="${DB_PASSWORD:-${_creds#* }}"; }
fi
DB_USER="${DB_USER:-training_user}"
DB_PASSWORD="${DB_PASSWORD:-training_2024}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups/foxlearn}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
echo "[$(date)] 开始备份 ${DB_NAME} → ${FILEPATH}"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces "$DB_NAME" | gzip > "$FILEPATH"
if [ -s "$FILEPATH" ]; then
  SIZE=$(du -h "$FILEPATH" | cut -f1)
  echo "[$(date)] ✅ 备份成功: ${FILENAME} (${SIZE})"
else
  echo "[$(date)] ❌ 备份失败"; rm -f "$FILEPATH"; exit 1
fi
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && echo "[$(date)] 🧹 清理 ${DELETED} 个过期备份"
echo "[$(date)] 完成"
