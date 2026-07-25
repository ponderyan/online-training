import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/auth/.auth/admin.json';

setup('authenticate as admin', async ({ page, request }) => {
  // 直接调 API 登录（绕过前端验证码 UI）
  const res = await request.post('http://localhost:3001/api/auth/login', {
    data: { username: 'admin', password: '123456' },
  });
  const data = await res.json();
  expect(data.accessToken).toBeTruthy();

  // 访问前端页面并注入 localStorage
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

  // 导航到 dashboard 验证登录态有效
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/.*dashboard/);

  await page.context().storageState({ path: authFile });
});
