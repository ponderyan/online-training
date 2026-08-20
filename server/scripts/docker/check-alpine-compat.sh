#!/bin/sh
# FoxLearn alpine/musl 兼容性验证脚本（需 Docker 环境，2026-08-21 by qwen）
# 用法：./scripts/docker/check-alpine-compat.sh
# 背景结论（本机无 Docker，静态分析 + 二进制证据）：
#   1. onnxruntime-node（@huggingface/transformers 本地嵌入依赖）只发布 glibc 预编译，
#      musl 下 binding 加载失败 → 嵌入降级为关键词检索（服务不挂，语义检索失效）
#   2. puppeteer 需 alpine chromium 包 + 一堆系统库，维护成本高
#   3. prisma generator 未声明 binaryTargets，宿主机生成的 client 缺 musl 引擎
# 推荐：基础镜像用 node:22-bookworm-slim（glibc），绕开全部 musl 坑
set -e

echo "=== 1/3 alpine(musl) 环境验证 ==="
docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c '
  npm ci --omit=dev --ignore-scripts 2>&1 | tail -2
  node -e "
    (async () => {
      try {
        const { pipeline } = await import(\"@huggingface/transformers\");
        const p = await pipeline(\"feature-extraction\", \"Xenova/bge-small-zh-v1.5\");
        console.log(\"EMBEDDING: OK（意外通过，请更新结论）\");
      } catch (e) {
        console.log(\"EMBEDDING: FAIL ->\", String(e.message).slice(0, 200));
        console.log(\"→ 符合预期：onnxruntime-node 无 musl 预编译，嵌入将降级关键词检索\");
      }
    })();
  "
'

echo ""
echo "=== 2/3 bookworm(glibc) 对照组 ==="
docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim sh -c '
  npm ci --omit=dev --ignore-scripts 2>&1 | tail -2
  node -e "
    (async () => {
      const { pipeline } = await import(\"@huggingface/transformers\");
      const p = await pipeline(\"feature-extraction\", \"Xenova/bge-small-zh-v1.5\");
      const out = await p(\"兼容性测试\", { pooling: \"mean\", normalize: true });
      console.log(\"EMBEDDING: OK，向量维度\", out.data.length);
    })().catch(e => { console.log(\"EMBEDDING: FAIL ->\", e.message); process.exit(1); });
  "
'

echo ""
echo "=== 3/3 结论 ==="
echo "若 1 FAIL 且 2 OK → 镜像选型定为 node:22-bookworm-slim，不用 alpine"
