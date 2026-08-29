import type { EmbeddingProvider } from "@/lib/integrity-vector-search";

const DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_ENDPOINT = "https://router.huggingface.co/hf-inference/models";

function flattenVector(value: unknown, dimensions: number): number[] {
  if (!Array.isArray(value)) return [];
  if (value.length && typeof value[0] === "number") return value.map(Number);
  if (value.length === 1) return flattenVector(value[0], dimensions);
  if (value.length && value.every((row) => Array.isArray(row))) {
    const rows = value
      .map((row) => flattenVector(row, dimensions))
      .filter((row) => row.length === dimensions && row.every(Number.isFinite));
    if (rows.length) {
      return Array.from({ length: dimensions }, (_, index) =>
        rows.reduce((sum, row) => sum + row[index], 0) / rows.length,
      );
    }
  }
  return [];
}

export function embeddingTextSample(text: string, maxChars = 12_000) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const section = Math.floor(maxChars / 3);
  const middleStart = Math.max(0, Math.floor(normalized.length / 2) - Math.floor(section / 2));
  return [
    normalized.slice(0, section),
    normalized.slice(middleStart, middleStart + section),
    normalized.slice(-section),
  ].join("\n");
}

export function configuredEmbeddingProvider(): EmbeddingProvider | null {
  const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim();
  if (!token) return null;
  const model = process.env.INTEGRITY_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
  const dimensions = Number(process.env.INTEGRITY_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS);
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) return null;
  const base = (process.env.HF_EMBEDDING_BASE_URL?.trim() || DEFAULT_ENDPOINT).replace(/\/$/, "");
  const modelPath = model.split("/").map(encodeURIComponent).join("/");

  return {
    model,
    dimensions,
    async embed(texts: string[]) {
      const vectors: number[][] = [];
      for (const text of texts) {
        const response = await fetch(`${base}/${modelPath}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: embeddingTextSample(text), options: { wait_for_model: true } }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
        const vector = flattenVector(await response.json(), dimensions);
        if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
          throw new Error(`Embedding dimension ${vector.length} does not match configured dimension ${dimensions}.`);
        }
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
