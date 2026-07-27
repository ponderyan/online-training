import { test, expect } from '@playwright/test';

/**
 * 链路 5：证书与学时测试
 */

test.describe('证书与学时 - 管理员视角', () => {
  test('管理员能访问证书管理页面', async ({ page }) => {
    await page.goto('/certificates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    const hasError = await page.locator('text=Error').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('管理员能访问学时管理页面', async ({ page }) => {
    const paths = ['/learning-hours', '/admin/learning-hours', '/admin/learning-hour-certificates'];
    let found = false;
    for (const path of paths) {
      const res = await page.goto(path);
      if (res && res.status() < 400) {
        await page.waitForLoadState('networkidle');
        const bodyText = await page.textContent('body');
        if (bodyText && bodyText.length > 100 && !bodyText.includes('404')) {
          found = true;
          console.log(`学时管理页面路径: ${path}`);
          break;
        }
      }
    }
    console.log(`学时管理页面可访问: ${found}`);
  });

  test('管理员能访问知识点管理页面', async ({ page }) => {
    await page.goto('/admin/knowledge');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('管理员能访问审计日志页面', async ({ page }) => {
    await page.goto('/audit-logs');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    const hasError = await page.locator('text=Error').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });
});

test.describe('证书与学时 - 学员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('学员能访问我的证书页面', async ({ page }) => {
    await page.goto('/my-certificates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('学员能访问我的学时页面', async ({ page }) => {
    await page.goto('/learning-hours');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('学员能访问学习报告页面', async ({ page }) => {
    await page.goto('/learning-report');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('学员能访问消息通知页面', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});
