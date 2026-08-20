import { SourceInfo } from './types.js';

/** 余弦相似度（归一化向量内积即可，但为稳妥保留完整计算） */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * RRF 融合（Reciprocal Rank Fusion）：多路检索结果按排名位置加权合并
 * score = Σ 1/(K + rank)；K=60 为常用常数
 */
export function rrfMerge(semantic: SourceInfo[], keyword: SourceInfo[], limit: number): SourceInfo[] {
  const scores = new Map<string, number>();
  const byKey = new Map<string, SourceInfo>();
  const key = (s: SourceInfo) => `${s.source}|${s.content.slice(0, 40)}`;

  const K = 60;
  semantic.forEach((s, i) => {
    const k = key(s);
    scores.set(k, (scores.get(k) || 0) + 1 / (K + i + 1));
    byKey.set(k, s);
  });
  keyword.forEach((s, i) => {
    const k = key(s);
    scores.set(k, (scores.get(k) || 0) + 1 / (K + i + 1));
    byKey.set(k, s);
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => byKey.get(k)!);
}
