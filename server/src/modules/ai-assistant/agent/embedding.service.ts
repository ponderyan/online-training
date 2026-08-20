import { Injectable, Logger } from '@nestjs/common';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

/**
 * 本地嵌入服务（bge-small-zh-v1.5，512 维，中文优化）
 * - 库硬编码 remoteHost=huggingface.co，不读 HF_ENDPOINT → 必须代码里指向镜像
 * - 懒加载 + 后台预载，失败优雅降级（available=false，调用方回退关键词检索）
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private model: FeatureExtractionPipeline | null = null;
  private _available = false;
  private loading: Promise<boolean> | null = null;

  constructor() {
    // 唯一正确姿势：代码内配置镜像（环境变量对该库无效）
    env.remoteHost = 'https://hf-mirror.com/';
  }

  get available(): boolean {
    return this._available;
  }

  /** Nest 启动后台预载（不阻塞启动） */
  onModuleInit() {
    this.ensureModel().catch(() => {});
  }

  /** 确保模型就绪，返回是否可用（并发安全：共享同一个 loading Promise） */
  ensureModel(): Promise<boolean> {
    if (this._available) return Promise.resolve(true);
    if (this.loading) return this.loading;
    this.loading = this.loadModel();
    return this.loading;
  }

  private async loadModel(): Promise<boolean> {
    try {
      this.model = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5');
      this._available = true;
      this.logger.log('本地嵌入模型已加载：bge-small-zh-v1.5 (512维)');
      return true;
    } catch (e) {
      this._available = false;
      this.logger.error(`本地嵌入模型加载失败，语义检索降级为关键词检索：${(e as Error)?.message}`);
      return false;
    }
  }

  /** 单条文本 → 512 维归一化向量（mean pooling + L2 normalize） */
  async embed(text: string): Promise<Float32Array> {
    const ok = await this.ensureModel();
    if (!ok || !this.model) {
      throw new Error('embedding-unavailable');
    }
    const output = await this.model(this.truncate(text, 510), { pooling: 'mean', normalize: true });
    return output.data as Float32Array;
  }

  /**
   * 批量嵌入（逐条计算，按批等待；bge 支持最长 ~512 token）
   * 返回与 inputs 等长数组；单条失败时该位为 null（不整体失败）
   */
  async embedBatch(texts: string[]): Promise<(Float32Array | null)[]> {
    const ok = await this.ensureModel();
    if (!ok || !this.model) return texts.map(() => null);
    const results: (Float32Array | null)[] = [];
    for (const t of texts) {
      try {
        const output = await this.model(this.truncate(t, 510), { pooling: 'mean', normalize: true });
        results.push(output.data as Float32Array);
      } catch (e) {
        this.logger.warn(`嵌入单条失败：${(e as Error)?.message}`);
        results.push(null);
      }
    }
    return results;
  }

  private truncate(text: string, maxTokens: number): string {
    // 中文按字符近似（1 字 ≈ 1 token），粗暴截断防超长
    return text.length <= maxTokens ? text : text.slice(0, maxTokens);
  }
}
