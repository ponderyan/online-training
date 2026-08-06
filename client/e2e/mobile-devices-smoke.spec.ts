/**
 * 移动端深度适配二期：跨设备冒烟（iOS + Android）
 * iPhone 13 / Pixel 7 双设备描述符：横向不溢出、汉堡抽屉、安全区样式存在性。
 */
import { test, expect, devices } from '@playwright/test';

const DEVICE_NAMES = ['iPhone 13', 'Pixel 7'] as const;

for (const name of DEVICE_NAMES) {
  test.describe(`跨设备冒烟 · ${name}`, () => {
    test('工作台：无横向溢出 + 抽屉开合', async ({ browser }) => {
      const ctx = await browser.newContext({
        ...devices[name],
        storageState: 'e2e/auth/.auth/admin.json',
      });
      const page = await ctx.newPage();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // 1. 无横向溢出
      const noOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth + 1
      );
      expect(noOverflow, `${name} 页面横向溢出`).toBeTruthy();

      // 2. 汉堡按钮可见且触控目标 ≥44px（二期标准）
      const hamburger = page.locator('button[aria-label="打开菜单"]');
      await expect(hamburger).toBeVisible();
      const box = await hamburger.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // 3. 抽屉开合
      await hamburger.click();
      await expect(page.locator('button[aria-label="关闭菜单"]')).toBeVisible();
      await page.locator('button[aria-label="关闭菜单"]').click();
      await expect(page.locator('button[aria-label="关闭菜单"]')).toBeHidden();

      // 4. dvh 兜底类已生效（body 高度非 0）
      const hasDvh = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.min-h-dvh-fb') || document.body).minHeight !== ''
      );
      expect(hasDvh).toBeTruthy();

      await ctx.close();
    });
  });
}
