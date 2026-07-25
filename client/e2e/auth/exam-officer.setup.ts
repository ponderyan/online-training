import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/auth/.auth/exam-officer.json';

setup('authenticate as exam_officer', async ({ page, request }) => {
  const res = await request.post('http://localhost:3001/api/auth/login', {
    data: { username: 'exam_officer', password: '123456' },
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
  await expect(page).toHaveURL(/.*dashboard/);

  await page.context().storageState({ path: authFile });
});
