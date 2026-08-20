import { test, expect, type Page } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * AI 助教（Agent 化会话模式）e2e
 *
 * 依赖：真实后端 3001 + DeepSeek API（真实 agent 调用）。
 * 断言刻意宽松——知识库可能为空，agent 会「检索两次→诚实说找不到→常识兜底」，
 * 因此测试验证的是前端装配（SSE 处理、会话侧栏、loading→done 状态机）而非模型回答内容。
 */
test.describe('AI 助教 - 会话模式', () => {
  test.use({ storageState: 'e2e/auth/.auth/student.json' });

  test('页面正常渲染：标题 + 新对话 + 空态', async ({ page }) => {
    await page.goto('/ai/assistant');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);

    await expect(page.getByText('🦊 AI 助教')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ 新对话' })).toBeVisible();
    // 空态：示例问题卡
    await expect(page.getByText('你可以问我这些 👇')).toBeVisible();
    await expect(page.getByText('ITSS 认证的报名条件是什么？')).toBeVisible();
  });

  test('发送问题 → loading → 完成 → 回答气泡出现', async ({ page }) => {
    await page.goto('/ai/assistant');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);

    const input = page.getByPlaceholder(/输入您的问题/);
    await input.fill('ITSS 是什么？');
    await page.getByRole('button', { name: '发送' }).click();

    // 进入加载态：输入框禁用、出现「停止」
    await expect(page.getByRole('button', { name: '停止' })).toBeVisible({ timeout: 15_000 });
    await expect(input).toBeDisabled();

    // 等待 agent 完成（真实 DeepSeek 调用 + 流式输出，给足时间）
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible({ timeout: 90_000 });
    await expect(input).toBeEnabled();

    // 断言消息区里用户问题已渲染且至少有一条助教侧消息
    // 作用域限定消息容器（侧栏会话标题、助教回答标题也可能含同一文本）
    const msgArea = page.locator('.space-y-4.max-w-3xl');
    await expect(msgArea.getByText('ITSS 是什么？').first()).toBeVisible();
    // 助教回复气泡存在且非空
    const bubbleTexts = await msgArea.allTextContents();
    const joined = bubbleTexts.join(' ');
    expect(joined.length).toBeGreaterThan('ITSS 是什么？'.length);
    await expect(msgArea.getByText('🦊').first()).toBeVisible();
  });

  test('会话持久化：新对话后问题产生会话，侧栏出现记录', async ({ page }) => {
    await page.goto('/ai/assistant');
    await page.waitForLoadState('networkidle');

    // 先开一个新对话（保证可命中唯一会话）
    await page.getByRole('button', { name: '+ 新对话' }).click();

    const input = page.getByPlaceholder(/输入您的问题/);
    await input.fill('如何获取学时证明？');
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.getByRole('button', { name: '停止' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible({ timeout: 90_000 });

    // 侧栏出现该会话（标题可能自动生成，也可能是默认「新对话」）
    // 作用域限定到会话滚动容器，避免误匹配顶部「+ 新对话」按钮
    const sessionList = page.locator('aside > div.flex-1.overflow-y-auto');
    await expect(sessionList.getByText(/如何获取学时证明|新对话/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('删除会话：确认后从侧栏移除', async ({ page }) => {
    // 先导航（storageState 注入的 token 在 localStorage，须在站内才能读）
    await page.goto('/ai/assistant');
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);

    // 通过 API 造一个会话（不依赖模型），再走 UI 删除
    const sessionId = await createSessionViaApi(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expectNoPageError(page);

    // 侧栏出现该会话
    const item = page.locator(`aside >> text=e2e-删除测试`);
    await expect(item.first()).toBeVisible({ timeout: 15_000 });

    // hover 显示删除按钮；先注册 dialog 监听再点击（confirm 同步触发）
    await item.first().hover();
    const delBtn = page.locator('aside button[title="删除会话"]').first();
    acceptDialog(page);
    await delBtn.click({ force: true }).catch(() => {
      return delBtn.click({ force: true });
    });

    // 从侧栏移除
    await expect(item.first()).toHaveCount(0, { timeout: 15_000 });
    // 服务端也删了
    const res = await page.request.get(`http://localhost:3001/api/ai/sessions/${sessionId}`, {
      headers: await authHeaders(page),
    });
    expect(res.status()).toBe(404);
  });
});

/** 通过 API 创建一个会话（标题已设好），返回会话 id */
async function createSessionViaApi(page: Page): Promise<number> {
  const headers = await authHeaders(page);
  const res = await page.request.post('http://localhost:3001/api/ai/sessions', {
    headers,
    data: { title: 'e2e-删除测试' },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  return json.id as number;
}

/** 从 localStorage 读取 token（与 auth setup 注入方式一致） */
async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  return { Authorization: `Bearer ${token}` };
}

/** 接受页面 confirm() 对话框 */
function acceptDialog(page: Page): void {
  page.once('dialog', (d) => d.accept().catch(() => {}));
}
