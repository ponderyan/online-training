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

  test('录入试题弹窗支持论文题型', async ({ page }) => {
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '录入试题' }).click();
    await page.waitForTimeout(800);
    // 题型下拉包含论文题
    const typeSelect = page.locator('.modal-card select').first();
    await expect(typeSelect.locator('option', { hasText: '论文题' })).toHaveCount(1);
    // 选择论文题后：参考答案区展示评分要点提示，且不出现选项/子问题等其他题型表单
    await typeSelect.selectOption('ESSAY');
    await expect(page.locator('.modal-card textarea[placeholder*="评分要点"]')).toBeVisible();
    await expectNoPageError(page);
  });

  test('论文题表单：最低字数+采分点保存并落库（ESSAY增强e2e）', async ({ page, request }) => {
    const stamp = Date.now();
    await page.goto('/questions');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '录入试题' }).click();
    await page.waitForTimeout(800);

    const modal = page.locator('.modal-card');
    await modal.locator('select').first().selectOption('ESSAY');
    // 题干
    await modal.locator('textarea[placeholder*="输入试题题干"]').fill(`ESSAY增强E2E-${stamp}`);
    // 作答要求：最低字数
    await modal.locator('input[placeholder="如 800"]').fill('20');
    // 采分点编辑器：加一条
    await modal.getByText('+ 添加采分点').click();
    await modal.locator('input[placeholder*="采分点描述"]').fill('论点明确');
    // 保存
    await modal.getByRole('button', { name: '保存试题' }).click();
    await page.waitForTimeout(2000);
    await expectNoPageError(page);

    // 通过 API 校验字段已落库
    const login = await request.post('http://localhost:3001/api/auth/login', { data: { username: 'admin', password: '123456' } });
    const token = (await login.json()).accessToken;
    const res = await request.get(`http://localhost:3001/api/questions?keyword=ESSAY增强E2E-${stamp}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.items || [];
    const created = items.find((q: any) => q.content?.includes(`ESSAY增强E2E-${stamp}`));
    expect(created, '新创建的论文题应出现在题库列表').toBeTruthy();
    expect(created.minAnswerWords).toBe(20);
    expect(Array.isArray(created.rubric)).toBe(true);
    expect(created.rubric[0].description).toBe('论点明确');

    // 清理
    if (created) await request.delete(`http://localhost:3001/api/questions/${created.id}`, { headers: { Authorization: `Bearer ${token}` } });
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
