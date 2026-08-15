import { test, expect } from '@playwright/test';

/**
 * 真测试：证书模板硬删除流程（2026-08-15）
 *
 * 背景：用户问「停用废弃的证书模板不能删除吗？如果模板没被引用且有废弃原因，应该可以删除」。
 * 本次改动：仅已停用的模板出现「删除」入口 → 弹窗必填废弃原因（空原因确认按钮置灰）→
 *         确认后模板从库中删除（卡片消失 + toast「模板已删除」）。
 *
 * 前置：LOGIN_REQUIRE_CAPTCHA=false + 节流放宽；dev server 3000 / server 3001 在跑。
 * 注意：本测试会真实创建并删除一个测试模板；测完由 spec 清理残留（模板/审计记录）。
 */

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3001/api';

test.describe('证书模板硬删除', () => {
  test('停用模板删除入口 + 原因必填 + 确认后卡片消失', async ({ page, request }) => {
    // ── 造数据：登录 admin → 创建模板 → 停用 ──
    const login = await request.post(`${API}/auth/login`, { data: { username: 'admin', password: '123456' } });
    const loginData = await login.json();
    expect(loginData.accessToken).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${loginData.accessToken}` };
    const tag = `e2e-del-${Date.now().toString(36)}`;

    const created = await request.post(`${API}/certificate-templates`, {
      headers: authHeaders,
      data: { name: tag, type: 'COMPLETION', orgId: null, description: 'e2e 删除测试模板', canvasJson: { width: 1123, height: 794, elements: [] } },
    });
    const createdBody = await created.json();
    expect(createdBody.id).toBeTruthy();
    const tplId = createdBody.id as number;

    const stopped = await request.delete(`${API}/certificate-templates/${tplId}`, { headers: authHeaders });
    expect(stopped.ok()).toBeTruthy();

    // 清理：finally 中硬删残留模板（若删除流程已成功则 404，catch 忽略）
    try {
      // ── 页面操作 ──
      await page.goto(`${BASE}/admin/certificate-templates`);
      await page.waitForSelector('.ct-card, .ct-row', { timeout: 15000 });

      // 切列表视图（无需 hover，定位稳定；按钮为纯 SVG，用 title 属性定位）
      const listToggle = page.locator('.ct-vbtn[title="列表视图"]');
      await listToggle.click();
      await page.waitForSelector('.ct-row', { timeout: 8000 });

      // 找到停用测试模板所在行，点「删除」
      const row = page.locator(`.ct-row:has-text("${tag}")`).first();
      await expect(row).toBeVisible({ timeout: 8000 });
      const delBtn = row.locator('.ct-act.danger:has-text("删除")');
      await expect(delBtn).toBeVisible({ timeout: 5000 });
      await delBtn.click();

      // ── 弹窗：必填原因 ──
      const modal = page.locator('.modal-card');
      await expect(modal).toBeVisible({ timeout: 5000 });
      await expect(modal).toContainText('删除');
      const confirmBtn = modal.locator('button:has-text("确认删除")');
      // 空原因 → 确认置灰（required 模式）
      await expect(confirmBtn).toBeDisabled();

      // 点预设原因 → 确认可用
      const preset = modal.locator('button:has-text("版式已重构，旧模板下线")');
      await preset.click();
      const textarea = modal.locator('textarea');
      await expect(textarea).toHaveValue('版式已重构，旧模板下线');
      await expect(confirmBtn).toBeEnabled();
      await confirmBtn.click();

      // ── 删除后：toast + 行消失 ──
      await expect(page.locator('text=模板已删除').first()).toBeVisible({ timeout: 8000 });
      await expect(row).toHaveCount(0, { timeout: 8000 });
      await page.waitForTimeout(400);
      console.log(`✅ 模板硬删除 e2e 全链路通过（创建→停用→列表删除入口→原因必填→预设原因→确认→卡片消失）`);
    } finally {
      // 清理残留（若已删除则 404，忽略）
      await request.post(`${API}/certificate-templates/${tplId}/permanent`, {
        headers: authHeaders,
        data: { reason: 'e2e 清理' },
      }).catch(() => {});
    }
  });
});
