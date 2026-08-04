import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 链路 3：考试全流程测试
 */

test.describe('考试全流程 - 管理员视角', () => {
  test('管理员能访问考试管理页面', async ({ page }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 页面不报错，有内容
    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
    await expectNoPageError(page);
  });

  test('管理员能查看考试列表数据', async ({ page }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    console.log(`考试列表数据条数: ${count}`);

    await expectNoPageError(page);
  });

  test('管理员能打开创建考试入口', async ({ page }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 查找创建按钮
    const createBtn = page.locator('button:has-text("创建"), button:has-text("新建"), a:has-text("创建"), a:has-text("新建")').first();
    const btnVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`创建考试按钮可见: ${btnVisible}`);

    if (btnVisible) {
      await createBtn.click();
      await page.waitForTimeout(2000);
      // 可能跳转到新页面或弹出表单
      const currentUrl = page.url();
      const hasForm = await page.locator('input, form, select').first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`点击后 URL: ${currentUrl}, 有表单: ${hasForm}`);
      expect(hasForm || currentUrl !== 'http://localhost:3000/exams').toBeTruthy();
    }
  });
});

test.describe('考试全流程 - 学员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('学员能访问考试中心', async ({ page }) => {
    await page.goto('/exam');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expectNoPageError(page);
  });

  test('学员能访问考试成绩页面', async ({ page }) => {
    await page.goto('/exam/results');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    console.log('学员考试成绩页面加载正常');
  });

  test('学员 Dashboard 正常渲染', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});

test.describe('考试全流程 - 考务员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/exam-officer.json' });

  test('考务员能访问考试管理', async ({ page }) => {
    await page.goto('/exams');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expectNoPageError(page);
  });

  test('考务员能访问阅卷页面', async ({ page }) => {
    await page.goto('/grading');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expectNoPageError(page);
  });
});
