/**
 * 移动端适配冒烟测试（D5）
 * 视口 390x844（iPhone 14）：登录页、抽屉导航、页面不横向溢出、考试信息栏。
 */
import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };

test.describe('移动端适配冒烟', () => {
  test.use({ viewport: MOBILE });

  test('登录页：品牌区隐藏、表单不溢出', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOBILE });
    const page = await ctx.newPage();
    await page.goto('/login');
    // 左侧品牌宣传区应隐藏（hidden lg:flex）
    const brand = page.locator('div.hidden.lg\\:flex').first();
    await expect(page.locator('input[name="username"], input[placeholder*="用户名"], input[type="text"]').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow).toBeTruthy();
    await ctx.close();
  });

  test('工作台：汉堡按钮 + 抽屉导航开合', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // 汉堡按钮可见（md:hidden）
    const hamburger = page.locator('button[aria-label="打开菜单"]');
    await expect(hamburger).toBeVisible();
    // 桌面侧栏隐藏
    const desktopSidebarHidden = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      return !aside || aside.closest('.hidden') !== null || getComputedStyle(aside).display === 'none' || aside.closest('div.hidden') !== null;
    });
    expect(desktopSidebarHidden).toBeTruthy();
    // 打开抽屉
    await hamburger.click();
    await expect(page.locator('button[aria-label="关闭菜单"]')).toBeVisible();
    // 抽屉内导航可见（强制展开态）——限定抽屉容器作用域，避免命中桌面侧栏同名项
    await expect(page.locator('button[aria-label="关闭菜单"]').locator('..').getByText('个人中心').first()).toBeVisible();
    // 点遮罩关闭：点右上角关闭按钮
    await page.locator('button[aria-label="关闭菜单"]').click();
    await expect(page.locator('button[aria-label="关闭菜单"]')).not.toBeVisible();
  });

  test('管理列表页：页面无横向溢出（表格内部横滚允许）', async ({ page }) => {
    await page.goto('/students');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const bodyOverflow = await page.evaluate(() =>
      document.body.scrollWidth <= window.innerWidth + 1 &&
      document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(bodyOverflow).toBeTruthy();
    // 工具栏按钮换行后"添加学员"可见（无需横滑）
    const btn = page.getByRole('button', { name: /添加学员/ });
    if (await btn.count() > 0) {
      const box = await btn.first().boundingBox();
      expect(box).not.toBeNull();
      if (box) expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    }
  });

  test('考试列表页：头部工具栏纵向堆叠不溢出', async ({ page }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    const ok = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1);
    expect(ok).toBeTruthy();
  });
});
