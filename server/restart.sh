#!/bin/bash
# 安全重启 FoxLearn 后端服务器
# 等待端口释放后再启动，避免 EADDRINUSE

PORT=3001
PID=$(lsof -ti :$PORT 2>/dev/null)

if [ -n "$PID" ]; then
  echo "⏳ 正在停止旧进程 (PID $PID)..."
  kill -9 $PID 2>/dev/null
  # 循环等待端口释放（最多等 10 秒）
  for i in $(seq 1 20); do
    if ! lsof -ti :$PORT >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

echo "🚀 启动服务器..."
nohup node dist/main.js > /tmp/foxlearn-server.log 2>&1 &
sleep 2
echo "✅ 服务器已启动 (PID $(lsof -ti :$PORT))"
