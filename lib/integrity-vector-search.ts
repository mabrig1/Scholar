import type { PipelineStage } from "mongoose";

export type VectorCandidate = {
  id: string;
  title: string;
  text: string;
  url?: string;
  score: number;
};

export type EmbeddingProvider = {
  model: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

export type VectorCorpus = {
  search(vector: number[], options?: { limit?: number; institution?: string }): Promise<VectorCandidate[]>;
};

export async function semanticCandidates(
  text: string,
  provider: EmbeddingProvider,
  corpus: VectorCorpus,
  options: { limit?: number; institution?: string } = {},
) {
  if (!text.trim()) return [];
  const [vector] = await provider.embed([text.slice(0, 12_000)]);
  if (!vector || vector.length !== provider.dimensions) throw new Error("Embedding provider returned an unexpected vector dimension.");
  return corpus.search(vector, { limit: Math.min(options.limit || 20, 100), institution: options.institution });
}

export function atlasVectorPipeline(
  vector: number[],
  options: { index?: string; limit?: number; institution?: string; publicOnly?: boolean } = {},
): PipelineStage[] {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const stage: PipelineStage.VectorSearch["$vectorSearch"] = {
    index: options.index || "scholar_integrity_vectors",
    path: "embedding",
    queryVector: vector,
    numCandidates: Math.min(Math.max(limit * 20, 100), 10_000),
    limit,
  };
  const filters: Record<string, unknown>[] = [];
  if (options.institution) filters.push({ institution: options.institution });
  if (options.publicOnly) filters.push({ publicComparisonAllowed: true });
  if (filters.length) stage.filter = filters.length === 1 ? filters[0] : { $and: filters };
  return [{ $vectorSearch: stage }, { $project: { title: 1, text: 1, url: 1, score: { $meta: "vectorSearchScore" } } }];
}
