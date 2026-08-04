import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 链路 6：培训班全生命周期测试
 */

test.describe('培训班 - 管理员视角', () => {
  test('管理员能访问培训班管理页面', async ({ page }) => {
    await page.goto('/programs');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    await expectNoPageError(page);
  });

  test('管理员能访问学员管理页面', async ({ page }) => {
    await page.goto('/students');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    await expectNoPageError(page);
  });

  test('管理员能访问教材管理页面', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});

test.describe('培训班 - 学员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('学员能访问学习中心', async ({ page }) => {
    await page.goto('/learning-center');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    await expectNoPageError(page);
  });

  test('学员能访问视频课程页面', async ({ page }) => {
    await page.goto('/video');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('学员能访问个人中心', async ({ page }) => {
    await page.goto('/my/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});
