import { Inject, Injectable } from '@nestjs/common';
import { AgentTool } from './types.js';
import { DOMAIN_TOOLS } from './tool-tokens.js';

/**
 * 工具注册表 —— LLM 可选领域工具的注册/查询中心
 * 对应 DSH「工具注册 + 模型调度」思想；新工具只需 register 一次
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AgentTool>();

  constructor(@Inject(DOMAIN_TOOLS) domainTools: AgentTool[]) {
    for (const tool of domainTools) {
      this.register(tool);
    }
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具重复注册：${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  /** OpenAI tools 参数（直接透传给 chat/completions） */
  schemas(): { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }[] {
    return this.list().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
}
