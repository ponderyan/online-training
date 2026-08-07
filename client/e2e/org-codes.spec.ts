/**
 * 组织编码 Phase 2：词典 CRUD + 规则 + 预览 e2e
 * 注意：关键词带唯一后缀，避免历史残留行干扰；编辑态行用“含 input”定位（关键词进入 input value 后 hasText 失配）
 */
import { test, expect } from '@playwright/test';

test.describe('组织编码字典', () => {
  test('词典 CRUD + 分隔符 + 预览', async ({ page }) => {
    const kw = `E2E部${Date.now() % 1000000}`;
    await page.goto('/admin/settings/codes');
    await page.waitForLoadState('networkidle');

    // ── 新增 ──
    await page.getByPlaceholder('关键词').fill(kw);
    await page.getByPlaceholder('缩写').fill('te');
    await page.locator('button', { hasText: '＋' }).click();
    const row = page.locator('div.flex.items-center').filter({ hasText: kw }).last();
    await expect(row).toBeVisible();
    await expect(row.locator('span').filter({ hasText: /^TE$/ })).toBeVisible(); // 大写化

    // ── 编辑（编辑态行是唯一含 input 的行） ──
    await row.getByText('✎').click();
    const editRow = page.locator('div.flex.items-center').filter({ has: page.locator('input') }).filter({ hasNot: page.locator('select') }).last();
    await editRow.locator('input').nth(1).fill('TX');
    await editRow.locator('button', { hasText: '✓' }).click();
    await expect(row.locator('span').filter({ hasText: /^TX$/ })).toBeVisible();

    // ── 两步删除（替代原生 confirm） ──
    await row.locator('button').filter({ hasText: /🗑|确认/ }).click();
    await expect(row.getByText('确认?')).toBeVisible();
    await row.getByText('确认?').click();
    await expect(page.getByText(kw)).toBeHidden();

    // ── 分隔符可输入 "-"（回归：曾被过滤正则误伤） ──
    const sep = page.locator('input[maxlength="2"]');
    await sep.fill('');
    await sep.pressSequentially('-');
    await expect(sep).toHaveValue('-');

    // ── 编码预览 ──
    await page.getByPlaceholder('输入组织名称').fill('创新部');
    await page.locator('button', { hasText: '预览' }).click();
    await expect(page.getByText(/CX/).first()).toBeVisible();
  });
});
