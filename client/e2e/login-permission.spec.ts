import { test, expect } from '@playwright/test';

/**
 * 链路 1：登录与权限测试
 */

const ACCOUNTS = [
  { username: 'admin', role: 'SUPER_ADMIN', expectMenu: ['工作台', '系统管理'] },
  { username: 'org_admin', role: 'ORG_ADMIN', expectMenu: ['工作台', '培训管理'] },
  { username: 'exam_officer', role: 'EXAM_OFFICER', expectMenu: ['工作台', '考务管理'] },
  { username: 'lecturer01', role: 'LECTURER', expectMenu: ['工作台'] },
  { username: 'proctor01', role: 'PROCTOR', expectMenu: ['工作台'] },
  { username: 'agency_admin', role: 'AGENCY_ADMIN', expectMenu: ['工作台'] },
  { username: 'auditor01', role: 'AUDITOR', expectMenu: ['工作台', '审计管理'] },
  // 学员端不显示分组标题，显示具体菜单项
  { username: 'stu001', role: 'STUDENT', expectMenu: ['我的考试', '学习中心'] },
];

test.describe('登录与权限', () => {
  for (const account of ACCOUNTS) {
    test(`${account.role} 登录后看到正确菜单`, async ({ page, request }) => {
      const res = await request.post('http://localhost:3001/api/auth/login', {
        data: { username: account.username, password: '123456' },
      });
      const data = await res.json();
      expect(data.accessToken).toBeTruthy();

      await page.goto('http://localhost:3000/login');
      await page.evaluate(({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (user.permissions) {
          localStorage.setItem('userPermissions', JSON.stringify({
            permissions: user.permissions,
            roles: user.roles || [],
          }));
        }
      }, { token: data.accessToken, user: data.user });

      await page.goto('http://localhost:3000/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

      for (const menu of account.expectMenu) {
        await expect(page.locator(`text=${menu}`).first()).toBeVisible({ timeout: 8000 });
      }
    });
  }

  test('登录页 UI 正常渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[placeholder="请输入用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="请输入密码"]')).toBeVisible();
    await expect(page.locator('input[placeholder="计算结果"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('未登录访问 dashboard 被拦截', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.evaluate(() => localStorage.clear());

    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    const hasLogin = url.includes('login') ||
      await page.locator('input[placeholder="请输入密码"]').isVisible().catch(() => false);
    expect(hasLogin).toBeTruthy();
  });

  test('错误密码 API 返回错误', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'admin', password: 'wrong_password' },
    });
    const data = await res.json();
    expect(data.accessToken).toBeFalsy();
  });
});
