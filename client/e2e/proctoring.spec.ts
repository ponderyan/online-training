import { test, expect } from '@playwright/test';
import { expectNoPageError } from './helpers';

/**
 * 监考中心：监考面板 + 大屏座舱模式
 * 数据全动态创建（不依赖 seed），CI 与本地行为一致
 */

const API = 'http://localhost:3001/api';
let token = '';
let examId = 0;
let paperId = 0;
let questionId = 0;
const stamp = Date.now();

test.describe('监考中心', () => {
  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${API}/auth/login`, { data: { username: 'admin', password: '123456' } });
    token = (await login.json()).accessToken;
    expect(token).toBeTruthy();

    // 建题 + 组卷 + 建考试（不发布，board/面板查看不依赖发布状态）
    const q = await request.post(`${API}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        subjectId: 1, chapterId: 1, type: 'SINGLE_CHOICE',
        content: `监考E2E题-${stamp}`, difficulty: 'EASY',
        options: [
          { label: 'A', content: '对', isCorrect: true },
          { label: 'B', content: '错', isCorrect: false },
        ],
      },
    });
    questionId = (await q.json()).id;

    const p = await request.post(`${API}/papers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `监考E2E卷-${stamp}`, subjectId: 1, createdBy: 1, totalScore: 100, durationMinutes: 60 },
    });
    paperId = (await p.json()).id;
    await request.post(`${API}/papers/${paperId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { questionId, score: 100, typeSection: '单选题' },
    });
    await request.put(`${API}/papers/${paperId}/finalize`, { headers: { Authorization: `Bearer ${token}` } });

    const now = Date.now();
    const e = await request.post(`${API}/exams`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `监考E2E考试-${stamp}`, paperId,
        startTime: new Date(now - 5 * 60000).toISOString(),
        endTime: new Date(now + 120 * 60000).toISOString(),
        durationMinutes: 60,
      },
    });
    examId = (await e.json()).id;
    expect(examId).toBeTruthy();

    // 分配一名考生（供大屏下钻用例使用）
    const stuRes = await request.get(`${API}/students?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
    const stuBody = await stuRes.json();
    const studentId = stuBody?.items?.[0]?.id;
    if (studentId) {
      await request.post(`${API}/exams/${examId}/add-students`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { studentIds: [studentId] },
      });
    }
  });

  test.afterAll(async ({ request }) => {
    const h = { headers: { Authorization: `Bearer ${token}` } };
    if (examId) await request.delete(`${API}/exams/${examId}`, h).catch(() => {});
    if (paperId) await request.delete(`${API}/papers/${paperId}`, h).catch(() => {});
    if (questionId) await request.delete(`${API}/questions/${questionId}`, h).catch(() => {});
  });

  test('监考列表页正常渲染', async ({ page }) => {
    await page.goto('/proctoring');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expectNoPageError(page);
    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('监考面板：概览卡片含缺考统计 + 大屏监考入口', async ({ page }) => {
    await page.goto(`/proctoring/${examId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expectNoPageError(page);

    // ★ 考试信息头（2026-08-12）：真实考试名 + 答题时长 + 窗口 + 倒计时语义
    await expect(page.getByText(`监考E2E考试-${stamp}`).first()).toBeVisible();
    await expect(page.getByTestId('panel-duration')).toContainText('答题时长 60 分钟');
    await expect(page.getByTestId('panel-window')).toContainText('硬截止');
    await expect(page.getByTestId('panel-window-line')).toContainText(/进行中|距开考|已结束/);
    // 概览卡片含缺考项（含筛选 tab，取首个）
    await expect(page.getByText('🚫 缺考').first()).toBeVisible();
    // 大屏入口按钮
    await expect(page.getByRole('button', { name: /大屏监考/ })).toBeVisible();
    // 总考生卡片
    await expect(page.getByText('总考生').first()).toBeVisible();
  });

  test('大屏座舱模式：考试概况 + 统计条 + 违规动态面板渲染', async ({ page }) => {
    await page.goto(`/proctoring/${examId}/board`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await expectNoPageError(page);

    // 顶栏：考试标题 + 状态徽标
    await expect(page.getByText(`监考E2E考试-${stamp}`).first()).toBeVisible();
    await expect(page.getByText(/交卷进度/)).toBeVisible();
    // 统计条关键项
    await expect(page.getByText('总考生').first()).toBeVisible();
    // ★ 时间语义澄清（2026-08-12）：答题时长与窗口拆分显示 + 强制收卷时刻
    await expect(page.getByText(/答题时长 60 分钟/)).toBeVisible();
    await expect(page.getByTestId('board-timeline')).toContainText(/窗口剩余.*强制收卷|距开考|已截止/);
    // ★ 第 8 格：切屏违规（与"异常"区分）
    await expect(page.getByText('🔄 切屏违规')).toBeVisible();
    // 违规动态面板
    await expect(page.getByText('⚠️ 违规动态')).toBeVisible();
    // 退出/全屏按钮
    await expect(page.getByRole('button', { name: /退出大屏/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /全屏/ })).toBeVisible();
    // 数据通道徽标：实时推送（WS 生效）或轮询模式（降级兜底），两者必居其一
    await expect(page.getByTestId('board-refresh-hint')).toContainText(/实时推送|轮询模式/);
  });

  test('大屏下钻：点击考生卡片打开详情弹窗（含快捷操作）', async ({ page }) => {
    await page.goto(`/proctoring/${examId}/board`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await expectNoPageError(page);

    const card = page.getByTestId('session-card').first();
    const hasCard = await card.isVisible().catch(() => false);
    if (!hasCard) {
      // 无考生时跳过交互断言（数据环境差异兜底）
      await expect(page.getByText('暂无考生')).toBeVisible();
      return;
    }
    await card.click();
    await expect(page.getByTestId('session-detail-modal')).toBeVisible();
    // 快捷操作按钮齐备 + 警告预设话术（2026-08-12）
    await expect(page.getByTestId('btn-warn')).toBeVisible();
    await expect(page.getByTestId('warn-presets')).toBeVisible();
    await expect(page.getByTestId('btn-force-submit')).toBeVisible();
    // 监考留痕区存在
    await expect(page.getByText('📋 监考操作留痕')).toBeVisible();
  });
});
