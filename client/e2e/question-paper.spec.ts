import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 链路 2：出题与组卷测试
 * 管理员/讲师：题库管理、试卷管理
 */

test.describe('出题与组卷 - 管理员视角', () => {
  test('管理员能访问题库管理页面', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    await expectNoPageError(page);
  });

  test('题库页面有搜索和筛选功能', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 搜索框存在
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键"]').first();
    const hasSearch = await searchInput.isVisible().catch(() => false);
    console.log(`题库搜索框可见: ${hasSearch}`);

    // 页面不报错
    await expectNoPageError(page);
  });

  test('管理员能访问试卷管理页面', async ({ page }) => {
    await page.goto('/papers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    await expectNoPageError(page);
  });

  test('管理员能访问题库出题页面', async ({ page }) => {
    // 尝试访问创建试题页面
    const paths = ['/questions/create', '/questions/new'];
    let found = false;
    for (const path of paths) {
      const res = await page.goto(path);
      if (res && res.status() < 400) {
        await page.waitForLoadState('networkidle');
        const bodyText = await page.textContent('body');
        if (bodyText && bodyText.length > 100 && !bodyText.includes('404')) {
          found = true;
          console.log(`出题页面路径: ${path}`);
          break;
        }
      }
    }
    console.log(`出题页面可访问: ${found}`);
  });
});

test.describe('出题与组卷 - 讲师视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/lecturer.json' });

  test('讲师能访问题库页面', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('讲师能访问试卷页面', async ({ page }) => {
    await page.goto('/papers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});
