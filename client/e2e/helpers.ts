import { expect, type Page } from '@playwright/test';

/**
 * 断言页面没有真实错误（替代裸文本脆弱断言）。
 *
 * 背景：早期用例用 page.locator('text=Error' / 'text=403' / 'text=500') 做存在性检查，
 * 会误匹配页面任意含该子串的文本（如考试标题时间戳 守卫测试-1785769616500 含 "500"），
 * 导致 CI flaky。统一改用结构性精确选择器：
 *
 * 1. ErrorCard（接口失败内联卡片）：role="alert" 且含 ❌ 图标。
 *    不用裸 [role="alert"]——Toast 所有类型（含成功提示）也用该 role，会误报。
 * 2. Next.js 框架错误页：匹配其固定文案。
 */
export async function expectNoPageError(page: Page): Promise<void> {
  // ErrorCard：role=alert + ❌ 结构特征（成功 Toast 是 ✓，不会误中）
  const inlineErrorVisible = await page
    .locator('[role="alert"]:has-text("❌")')
    .first()
    .isVisible()
    .catch(() => false);
  expect(inlineErrorVisible, '页面出现内联错误卡片（ErrorCard）').toBe(false);

  // Next.js 错误页 / 服务端错误固定文案
  const errorPageVisible = await page
    .getByText(/Internal Server Error|Application error|A client-side exception has occurred|Uncaught Runtime Error/)
    .first()
    .isVisible()
    .catch(() => false);
  expect(errorPageVisible, '页面出现框架错误页').toBe(false);
}
