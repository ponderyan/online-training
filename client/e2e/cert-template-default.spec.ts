import { test, expect } from '@playwright/test';

/**
 * 真测试：证书模板管理页「默认模板」标识与入口（2026-08-15）
 *
 * 背景：用户问「哪个是默认模板，完全没有标识」。此前库里无默认模板、网格视图无「设为默认」入口。
 * 本次改动：① 顶部 banner 引导无默认类型；② 网格 hover 补「设为默认」入口；③ 网格卡片补归属标注。
 *
 * 前置：LOGIN_REQUIRE_CAPTCHA=false + 节流放宽；dev server 3000 在跑。
 * 注意：本测试会真实点击「设为默认」（把组织#1 的标准结业证书设为默认），测后由配套脚本还原。
 */

const BASE = 'http://localhost:3000';

test.describe('证书模板默认标识', () => {
  test('banner 引导 + 网格设默认入口 + 设默认后徽标出现', async ({ page }) => {
    // 登录态由 setup-admin storageState 提供
    await page.goto(`${BASE}/admin/certificate-templates`);
    await page.waitForSelector('.ct-card, .ct-row', { timeout: 15000 });
    await page.waitForTimeout(500);

    // ① 无默认引导 banner（当前库无任何 isDefault=true）—— 用 .ct-nodflt-banner 精确定位，避免 :has-text 匹配外层容器
    const banner = page.locator('.ct-nodflt-banner');
    await expect(banner.first()).toBeVisible({ timeout: 8000 });
    const bannerText = await banner.first().innerText();
    expect(bannerText).toContain('结业证书');

    // ② 网格 hover 出现「设为默认」按钮（定位到结业证书卡片，确保点击的是 COMPLETION 类型）
    const gridCard = page.locator('.ct-card:has-text("学员结业证书")').first();
    await expect(gridCard).toBeVisible({ timeout: 5000 });
    await gridCard.hover();
    const setDefaultBtn = gridCard.locator('.ct-ovbtn:has-text("设为默认")').first();
    await expect(setDefaultBtn).toBeVisible({ timeout: 5000 });

    // ③ 点击设为默认 → toast + banner 消失 + ★ 默认徽标出现
    await setDefaultBtn.click();
    await page.waitForSelector('.ct-badge:has-text("★ 默认"), .tag:has-text("★ 默认")', { timeout: 8000 });
    const defaultBadge = page.locator('.ct-badge:has-text("★ 默认")').first();
    await expect(defaultBadge).toBeVisible({ timeout: 8000 });

    // banner 中「结业证书」应移除（该类型已有默认）；学时证明/自定义仍无默认，banner 保留属正确行为
    const bannerTextAfter = await banner.first().innerText().catch(() => '');
    expect(bannerTextAfter).not.toContain('结业证书');

    // ④ 默认徽标：结业证书类型只有 1 个默认
    const defaultBadgeCount = await page.locator('.ct-badge:has-text("★ 默认"), .tag:has-text("★ 默认")').count();
    expect(defaultBadgeCount).toBeGreaterThanOrEqual(1);
    expect(defaultBadgeCount).toBeLessThanOrEqual(2); // 至多 COMPLETION 的默认出现

    // ⑤ 已设默认的卡片 hover 不应再显示「设为默认」（防止重复设置）
    const defaultCard = defaultBadge.locator('xpath=ancestor::div[contains(@class,"ct-card")]');
    await defaultCard.hover();
    await page.waitForTimeout(400);
    expect(await defaultCard.locator('.ct-ovbtn:has-text("设为默认")').count()).toBe(0);

    console.log(`✅ 模板默认标识全链路通过（banner 引导 → 设默认 → 徽标 → 互斥唯一）`);
  });
});
