import type { EmbeddingProvider } from "@/lib/integrity-vector-search";

const DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_ENDPOINT = "https://router.huggingface.co/hf-inference/models";

function flattenVector(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  if (value.length && typeof value[0] === "number") return value.map(Number);
  if (value.length === 1) return flattenVector(value[0]);
  return [];
}

export function configuredEmbeddingProvider(): EmbeddingProvider | null {
  const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim();
  if (!token) return null;
  const model = process.env.INTEGRITY_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
  const dimensions = Number(process.env.INTEGRITY_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS);
  const base = (process.env.HF_EMBEDDING_BASE_URL?.trim() || DEFAULT_ENDPOINT).replace(/\/$/, "");

  return {
    model,
    dimensions,
    async embed(texts: string[]) {
      const vectors: number[][] = [];
      for (const text of texts) {
        const response = await fetch(`${base}/${encodeURIComponent(model)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: text.slice(0, 12_000), options: { wait_for_model: true } }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
        const vector = flattenVector(await response.json());
        if (vector.length !== dimensions) throw new Error(`Embedding dimension ${vector.length} does not match configured dimension ${dimensions}.`);
        vectors.push(vector);
      }
      return vectors;
    },
  };
}

export function embeddingStatus() {
  const provider = configuredEmbeddingProvider();
  return provider ? { configured: true, model: provider.model, dimensions: provider.dimensions } : { configured: false, model: null, dimensions: null };
}
