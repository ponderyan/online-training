import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 链路 4：阅卷与成绩测试
 */

test.describe('阅卷与成绩 - 管理员视角', () => {
  test('管理员能访问阅卷管理页面', async ({ page }) => {
    await page.goto('/grading');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expectNoPageError(page);
    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('管理员能访问证书管理页面', async ({ page }) => {
    await page.goto('/certificates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expectNoPageError(page);
  });
});

test.describe('阅卷与成绩 - 学员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('学员能查看考试成绩', async ({ page }) => {
    await page.goto('/exam/results');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    await expectNoPageError(page);
    console.log('学员考试成绩页面正常');
  });

  test('学员能访问我的证书页面', async ({ page }) => {
    await page.goto('/my-certificates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    console.log('学员我的证书页面正常');
  });

  test('学员能访问我的学时页面', async ({ page }) => {
    await page.goto('/learning-hours');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    console.log('学员我的学时页面正常');
  });
});

test.describe('阅卷与成绩 - 讲师视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/lecturer.json' });

  test('讲师能访问阅卷页面', async ({ page }) => {
    await page.goto('/grading');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(20);
    console.log('讲师阅卷页面可访问');
  });
});
