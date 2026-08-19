# scripts/ — 一次性运维脚本与手工功能测试

> 2026-08-20 归档整理：此前散落在 server/ 根目录的 .mjs 脚本统一迁入本目录。

## 目录约定

| 目录 | 用途 |
|---|---|
| `scripts/*.ts` / `scripts/*.mjs` | 数据迁移 / 回填 / 种子 / 工具脚本 |
| `scripts/functional-tests/*.mjs` | 历史手工功能测试（配合修复任务留档，可复跑回归） |

## 运行方式

Node 包解析依赖 server/node_modules，**一律在 server/ 目录下执行**：

```bash
cd server
node scripts/functional-tests/cert_logic_fix_test.mjs
node scripts/backfill_cert_app_org.mjs
```

## 编写纪律（血泪教训）

1. **用 `process.exitCode = 1`，绝不用 `process.exit()`** —— 否则跳过 finally/cleanup，测试数据残留（8-13、8-15 两次踩坑）。
2. 测试前置：`LOGIN_REQUIRE_CAPTCHA=false` + 限流放宽（plist EnvironmentVariables 或 launchctl setenv），测后还原并 curl 验证 `captchaRequired:true`。
3. 测试数据零残留：脚本自带清理 + 测后复查（`e2e-` / `harddel-` 等前缀过滤）。
