import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

test.describe('练习模式 - 学员视角', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('练习模式首页正常渲染', async ({ page }) => {
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);
    await expect(page.getByText('练习模式').first()).toBeVisible();
  });

  test('随机练习支持全部 6 种题型选择', async ({ page }) => {
    await page.goto('/practice/random');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);
    for (const t of ['单选题', '多选题', '判断题', '填空题', '简答题', '案例题']) {
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '开始练习' })).toBeVisible();
  });

  test('开始练习后进入答题器（有题显示题卡，无题显示空态）', async ({ page }) => {
    await page.goto('/practice/random');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);
    await page.getByRole('button', { name: '开始练习' }).click();
    await page.waitForTimeout(2500);
    const body = await page.textContent('body');
    // 答题器元素之一必须出现：答题卡 / 做题模式 / 暂无练习题目
    const hasPlayer = body!.includes('答题卡') || body!.includes('做题模式') || body!.includes('暂无练习题目');
    expect(hasPlayer).toBeTruthy();
  });

  test('错题重练与收藏练习页面可访问', async ({ page }) => {
    await page.goto('/practice/wrong');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);
    await expect(page.getByText('错题重练').first()).toBeVisible();
    await page.goto('/practice/favorite');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);
    await expect(page.getByText('收藏练习').first()).toBeVisible();
  });
});
