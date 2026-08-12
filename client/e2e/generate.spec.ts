import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 智能组卷页（/generate）题型选择回归护栏
 * 背景：TYPE_NAMES 曾缺 ESSAY，论文题在组卷页完全不显示（2026-08-12 修复）
 */
test.describe('智能组卷 - 题型选择', () => {
  test('论文题出现在题型选择区，可勾选并展开参数配置', async ({ page }) => {
    await page.goto('/generate');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 选择区应包含论文题（未勾选时仅此 1 处）
    const essay = page.getByText('论文题', { exact: true });
    await expect(essay).toHaveCount(1);

    // 勾选论文题 → 参数配置面板出现（选择区 + 面板标题 = 2 处）
    await essay.first().click();
    await page.waitForTimeout(300);
    await expect(essay).toHaveCount(2);

    // 面板内应有题数/每题分值输入
    await expect(page.locator('input[inputmode="numeric"]').nth(0)).toBeVisible();

    await expectNoPageError(page);
  });
});
