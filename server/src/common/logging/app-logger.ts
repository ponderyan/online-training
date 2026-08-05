import * as fs from 'fs';
import * as path from 'path';

/**
 * 轻量结构化日志（零外部依赖）：
 * - JSON Lines 格式写入 logs/foxlearn-YYYY-MM-DD.log，按天滚动
 * - error 级别同时输出到 stderr（LaunchAgent 的 foxlearn-server.log 兜底可见）
 * - 启动时清理 14 天前的日志文件
 * 设计动机：winston 安装遇 npm arborist bug，且项目仅需基础日志能力，避免引依赖。
 */
const LOG_DIR = process.env.LOG_DIR || path.resolve('logs');
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 14);

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  cleanOldLogs();
} catch (e) {
  console.warn(`[app-logger] 日志目录初始化失败: ${(e as Error).message}`);
}

let currentDate = today();
let stream: fs.WriteStream | null = null;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStream(): fs.WriteStream | null {
  try {
    const d = today();
    if (!stream || d !== currentDate) {
      stream?.end();
      currentDate = d;
      stream = fs.createWriteStream(path.join(LOG_DIR, `foxlearn-${d}.log`), { flags: 'a' });
      stream.on('error', () => {}); // 写盘失败不崩应用
    }
    return stream;
  } catch {
    return null;
  }
}

function cleanOldLogs() {
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
  for (const f of fs.readdirSync(LOG_DIR)) {
    if (!/^foxlearn-\d{4}-\d{2}-\d{2}\.log$/.test(f)) continue;
    const fp = path.join(LOG_DIR, f);
    try {
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    } catch {}
  }
}

function write(level: 'info' | 'warn' | 'error', meta: Record<string, any>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...meta });
  getStream()?.write(line + '\n');
  if (level === 'error') console.error(line);
}

export const appLogger = {
  info: (meta: Record<string, any>) => write('info', meta),
  warn: (meta: Record<string, any>) => write('warn', meta),
  error: (meta: Record<string, any>) => write('error', meta),
};
