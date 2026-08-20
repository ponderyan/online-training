import { test, expect } from '@playwright/test';

/**
 * 真测试：证书模板管理页「默认模板」标识与入口（2026-08-15 首版，2026-08-20 改自容）
 *
 * 背景：用户问「哪个是默认模板，完全没有标识」。此前库里无默认模板、网格视图无「设为默认」入口。
 * 本次改动：① 顶部 banner 引导无默认类型；② 网格 hover 补「设为默认」入口；③ 网格卡片补归属标注。
 *
 * ★ 2026-08-20 自容改造（原为有状态测试，跑完污染基线导致下轮全量 e2e 挂）：
 *   - 测前：API 快照当前所有 COMPLETION 默认模板 → 全部 clear-default（保证「无默认」前置态）
 *   - 测试：API 自建一个 COMPLETION 测试模板，全部 UI 断言针对测试模板卡片（不碰基线模板）
 *   - 测后：finally 中停用+硬删测试模板、还原测前默认快照 —— 任意失败也不留污染
 * ★ 2026-08-20 二修（基线漂移：seed demo 模板已为自定义/学时证明设了默认，全局徽标定位瞬时伪通过）：
 *   - 徽标等待改为「测试卡片内的 ★ 默认」（refetch 后才出现，天然等到状态同步）
 *   - 徽标计数断言收敛到测试卡片，不再假设全局默认数量
 *
 * 前置：LOGIN_REQUIRE_CAPTCHA=false + 节流放宽；dev server 3000 在跑。
 */

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3001/api';

test.describe('证书模板默认标识', () => {
  test('banner 引导 + 网格设默认入口 + 设默认后徽标出现', async ({ page, request }) => {
    // ── 登录 + 测前快照/清基线 ──
    const login = await request.post(`${API}/auth/login`, { data: { username: 'admin', password: '123456' } });
    const loginData = await login.json();
    expect(loginData.accessToken).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${loginData.accessToken}` };

    const listRes = await request.get(`${API}/certificate-templates?type=COMPLETION`, { headers: authHeaders });
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    const prevDefaultIds: number[] = Array.isArray(list)
      ? list.filter((t: any) => t.isDefault).map((t: any) => t.id)
      : [];
    for (const id of prevDefaultIds) {
      const r = await request.post(`${API}/certificate-templates/${id}/clear-default`, { headers: authHeaders });
      expect(r.ok()).toBeTruthy();
    }

    // ── 自建测试模板（不碰基线模板） ──
    const tag = `e2e-def-${Date.now().toString(36)}`;
    const created = await request.post(`${API}/certificate-templates`, {
      headers: authHeaders,
      data: { name: tag, type: 'COMPLETION', orgId: null, description: 'e2e 默认标识自容测试模板', canvasJson: { width: 1123, height: 794, elements: [] } },
    });
    const createdBody = await created.json();
    expect(createdBody.id).toBeTruthy();
    const tplId = createdBody.id as number;

    try {
      // 登录态由 setup-admin storageState 提供
      await page.goto(`${BASE}/admin/certificate-templates`);
      await page.waitForSelector('.ct-card, .ct-row', { timeout: 15000 });
      await page.waitForTimeout(500);

      // ① 无默认引导 banner（COMPLETION 默认已被清空）—— 用 .ct-nodflt-banner 精确定位，避免 :has-text 匹配外层容器
      const banner = page.locator('.ct-nodflt-banner');
      await expect(banner.first()).toBeVisible({ timeout: 8000 });
      const bannerText = await banner.first().innerText();
      expect(bannerText).toContain('结业证书');

      // ② 网格 hover 出现「设为默认」按钮（定位到自建测试模板卡片，确保点击的是 COMPLETION 类型）
      const gridCard = page.locator(`.ct-card:has-text("${tag}")`).first();
      await expect(gridCard).toBeVisible({ timeout: 5000 });
      await gridCard.hover();
      const setDefaultBtn = gridCard.locator('.ct-ovbtn:has-text("设为默认")').first();
      await expect(setDefaultBtn).toBeVisible({ timeout: 5000 });

      // ③ 点击设为默认 → toast + 测试卡片出现 ★ 默认徽标（refetch 后才渲染，天然等到状态同步；
      //    若用全局 badge 定位会被其他类型的既有默认徽标瞬时伪通过）
      await setDefaultBtn.click();
      const testCardBadge = gridCard.locator('.ct-badge:has-text("★ 默认")');
      await expect(testCardBadge).toBeVisible({ timeout: 8000 });

      // banner 中「结业证书」应移除（该类型已有默认）；学时证明/自定义仍无默认时 banner 保留属正确行为
      const bannerTextAfter = await banner.first().innerText().catch(() => '');
      expect(bannerTextAfter).not.toContain('结业证书');

      // ④ 测试卡片徽标唯一（只收敛到测试卡片，不假设全局默认数量 —— seed demo 模板可能已为其他类型设默认）
      expect(await gridCard.locator('.ct-badge:has-text("★ 默认")').count()).toBe(1);

      // ⑤ 已设默认的卡片 hover 不应再显示「设为默认」（防止重复设置）
      await gridCard.hover();
      await page.waitForTimeout(400);
      expect(await gridCard.locator('.ct-ovbtn:has-text("设为默认")').count()).toBe(0);

      console.log(`✅ 模板默认标识全链路通过（banner 引导 → 设默认 → 徽标 → 互斥唯一）`);
    } finally {
      // ── 还原：清理测试模板（停用清 isDefault → 硬删）+ 恢复测前默认快照 ──
      await request.delete(`${API}/certificate-templates/${tplId}`, { headers: authHeaders }).catch(() => {});
      await request.post(`${API}/certificate-templates/${tplId}/permanent`, {
        headers: authHeaders,
        data: { reason: 'e2e 默认标识自容测试清理' },
      }).catch(() => {});
      for (const id of prevDefaultIds) {
        await request.post(`${API}/certificate-templates/${id}/set-default`, { headers: authHeaders }).catch(() => {});
      }
    }
  });
});
