import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 监考中心：监考面板 + 大屏座舱模式
 * 依赖稳定 demo 数据：exam id=12（【Demo】数智化管理师线上统考，含 1 缺考学员）
 */

test.describe('监考中心', () => {
  test('监考列表页正常渲染并可进入监考面板', async ({ page }) => {
    await page.goto('/proctoring');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expectNoPageError(page);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('监考面板：概览卡片含缺考统计 + 大屏监考入口', async ({ page }) => {
    await page.goto('/proctoring/12');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expectNoPageError(page);

    // 概览卡片含缺考项
    await expect(page.getByText('🚫 缺考').first()).toBeVisible();
    // 大屏入口按钮
    await expect(page.getByRole('button', { name: /大屏监考/ })).toBeVisible();
    // 缺考筛选 tab
    await expect(page.getByRole('button', { name: /🚫 缺考/ })).toBeVisible();
  });

  test('大屏座舱模式：考试概况 + 统计条 + 考生宫格渲染', async ({ page }) => {
    await page.goto('/proctoring/12/board');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await expectNoPageError(page);

    // 顶栏：考试标题 + 试卷信息
    await expect(page.getByText(/数智化管理师线上统考/).first()).toBeVisible();
    await expect(page.getByText(/交卷进度/)).toBeVisible();
    // 统计条关键项
    await expect(page.getByText('总考生').first()).toBeVisible();
    // 考生宫格：至少出现张三或李四
    const grid = page.locator('text=张三').or(page.locator('text=李四'));
    expect(await grid.count()).toBeGreaterThan(0);
    // 缺考徽标
    await expect(page.getByText('缺考', { exact: true }).first()).toBeVisible();
    // 违规动态面板
    await expect(page.getByText('⚠️ 违规动态')).toBeVisible();
    // 退出按钮
    await expect(page.getByRole('button', { name: /退出大屏/ })).toBeVisible();
  });
});
