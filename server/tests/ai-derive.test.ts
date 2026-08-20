/**
 * AI 会话事件派生逻辑单测（纯函数，无网络/无 DB）
 * 覆盖 2026-08-20 修复的 400 回归：tool 消息前必须有 assistant-with-tool_calls
 */
import { describe, it, expect } from 'vitest';
import { deriveMessagesFromEvents, deriveDisplayFromEvents, DERIVE_WINDOW, EventLike } from '../src/modules/ai-assistant/agent/derive.js';

function ev(partial: Partial<EventLike> & { type: string; seq: number }): EventLike {
  return { content: null, role: null, toolCallId: null, toolName: null, toolResult: null, meta: null, ...partial };
}

describe('deriveMessagesFromEvents：事件日志 → OpenAI 消息', () => {
  it('纯问答：user / assistant 一一对应', () => {
    const events = [
      ev({ seq: 1, type: 'user', content: '什么是ITSS？' }),
      ev({ seq: 2, type: 'assistant', content: 'ITSS 是信息技术服务标准。' }),
      ev({ seq: 3, type: 'user', content: '再说细一点' }),
      ev({ seq: 4, type: 'assistant', content: '包括运维、实施等服务标准。' }),
    ];
    const msgs = deriveMessagesFromEvents(events);
    expect(msgs).toEqual([
      { role: 'user', content: '什么是ITSS？' },
      { role: 'assistant', content: 'ITSS 是信息技术服务标准。' },
      { role: 'user', content: '再说细一点' },
      { role: 'assistant', content: '包括运维、实施等服务标准。' },
    ]);
  });

  it('工具序列回归：assistant-with-tool_calls 必须出现在 tool 消息之前', () => {
    // 这是 2026-08-20 修复的 bug：之前缺失 assistant 事件导致 DeepSeek 400
    const events = [
      ev({ seq: 1, type: 'user', content: '我的薄弱环节？' }),
      ev({
        seq: 2,
        type: 'assistant',
        content: null,
        meta: {
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_recent_wrong', arguments: '{"count":10}' },
            },
          ],
        },
      }),
      ev({ seq: 3, type: 'tool-result', toolCallId: 'call_1', toolName: 'get_recent_wrong', toolResult: { weakPoints: [{ knowledgePoint: '数据治理', wrongCount: 2 }] } }),
      ev({ seq: 4, type: 'assistant', content: '你的薄弱点是数据治理。' }),
    ];
    const msgs = deriveMessagesFromEvents(events);
    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toEqual({ role: 'user', content: '我的薄弱环节？' });
    // assistant 事件带 tool_calls（内容为 null）
    expect(msgs[1]).toMatchObject({ role: 'assistant', content: null });
    expect((msgs[1] as any).tool_calls).toEqual([
      { id: 'call_1', type: 'function', function: { name: 'get_recent_wrong', arguments: '{"count":10}' } },
    ]);
    // tool 消息引用同一 tool_call_id，content 为 JSON 字符串
    expect(msgs[2]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '{"weakPoints":[{"knowledgePoint":"数据治理","wrongCount":2}]}',
    });
    expect(msgs[3]).toEqual({ role: 'assistant', content: '你的薄弱点是数据治理。' });
  });

  it('多工具并行：多个 tool_calls 合并在一个 assistant 消息内', () => {
    const events = [
      ev({ seq: 1, type: 'user', content: '查一下' }),
      ev({
        seq: 2,
        type: 'assistant',
        content: null,
        meta: {
          toolCalls: [
            { id: 'call_a', type: 'function', function: { name: 'search_knowledge', arguments: '{"query":"A"}' } },
            { id: 'call_b', type: 'function', function: { name: 'search_knowledge', arguments: '{"query":"B"}' } },
          ],
        },
      }),
      ev({ seq: 3, type: 'tool-result', toolCallId: 'call_a', toolResult: { message: 'A 结果' } }),
      ev({ seq: 4, type: 'tool-result', toolCallId: 'call_b', toolResult: { message: 'B 结果' } }),
    ];
    const msgs = deriveMessagesFromEvents(events);
    expect((msgs[1] as any).tool_calls).toHaveLength(2);
    expect(msgs[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_a' });
    expect(msgs[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_b' });
  });

  it('空日志返回空数组', () => {
    expect(deriveMessagesFromEvents([])).toEqual([]);
  });

  it('日志全留、派生截断：超过窗口只取最近 N 个', () => {
    const events = Array.from({ length: DERIVE_WINDOW + 10 }, (_, i) => ev({ seq: i + 1, type: i % 2 === 0 ? 'user' : 'assistant', content: `msg${i + 1}` }));
    const msgs = deriveMessagesFromEvents(events);
    expect(msgs.length).toBe(DERIVE_WINDOW); // 只派生窗口内数量
    expect((msgs[0] as any).content).toBe(`msg${events.length - DERIVE_WINDOW + 1}`);
  });
});

describe('deriveDisplayFromEvents：事件 → 前端展示', () => {
  it('工具调用步骤标注为"[已调用工具]"', () => {
    const events = [
      ev({ seq: 1, type: 'user', content: '查薄弱环节' }),
      ev({
        seq: 2,
        type: 'assistant',
        content: null,
        meta: { toolCalls: [{ id: 'c1', type: 'function', function: { name: 'get_recent_wrong', arguments: '{}' } }] },
      }),
      ev({ seq: 3, type: 'tool-result', toolCallId: 'c1', toolResult: {} }),
      ev({ seq: 4, type: 'assistant', content: '已分析。' }),
    ];
    const display = deriveDisplayFromEvents(events);
    expect(display).toHaveLength(3);
    expect(display[1]).toMatchObject({ role: 'assistant', content: '[已调用工具：get_recent_wrong]' });
    expect((display[1] as any).toolCalls).toEqual([{ name: 'get_recent_wrong', args: {} }]);
  });

  it('忽略非消息事件（step/error/tool-call）', () => {
    const events = [
      ev({ seq: 1, type: 'user', content: 'hi' }),
      ev({ seq: 2, type: 'step', meta: { phase: 'start' } }),
      ev({ seq: 3, type: 'tool-call', toolCallId: 'c1', toolName: 'search_knowledge' }),
      ev({ seq: 4, type: 'assistant', content: 'hello' }),
      ev({ seq: 5, type: 'error', content: 'x' }),
    ];
    const display = deriveDisplayFromEvents(events);
    expect(display.map((d) => d.role)).toEqual(['user', 'assistant']);
  });
});
