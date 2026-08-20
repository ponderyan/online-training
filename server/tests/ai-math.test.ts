/**
 * 检索纯函数单测：余弦相似度 + RRF 融合
 */
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, rrfMerge } from '../src/modules/ai-assistant/agent/math.js';
import { SourceInfo } from '../src/modules/ai-assistant/agent/types.js';

function src(source: string, content: string): SourceInfo {
  return { materialName: source, chapterTitle: '', content, source, type: 'chunk' };
}

describe('cosineSimilarity', () => {
  it('相同向量 = 1', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('正交向量 = 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('反向向量 = -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('零向量不产生 NaN（返回 0）', () => {
    const r = cosineSimilarity([0, 0], [1, 0]);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(0);
  });

  it('Float32Array 输入正常', () => {
    const a = new Float32Array([3, 4]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.8);
  });
});

describe('rrfMerge', () => {
  it('语义与关键词都命中的项排最前（RRF 相加）', () => {
    const semantic = [src('m1', 'ITSS 定义内容'), src('m2', '运维标准内容')];
    const keyword = [src('m2', '运维标准内容'), src('m3', '其他内容')];
    const merged = rrfMerge(semantic, keyword, 10);
    // m2 在两路都出现 → 应排第一
    expect(merged[0].source).toBe('m2');
    expect(merged).toHaveLength(3); // 去重后 3 条
  });

  it('仅一路命中的按排名保留', () => {
    const semantic = [src('a', 'A'), src('b', 'B')];
    const merged = rrfMerge(semantic, [], 10);
    expect(merged.map((m) => m.source)).toEqual(['a', 'b']);
  });

  it('limit 截断生效', () => {
    const semantic = [src('a', 'A'), src('b', 'B'), src('c', 'C')];
    expect(rrfMerge(semantic, [], 2)).toHaveLength(2);
  });
});
