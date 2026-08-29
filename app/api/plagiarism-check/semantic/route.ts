import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { CorpusSource } from "@/lib/integrity-corpus";
import { configuredEmbeddingProvider, embeddingStatus } from "@/lib/integrity-embeddings";
import { atlasVectorPipeline, semanticCandidates } from "@/lib/integrity-vector-search";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ...embeddingStatus(), index: process.env.INTEGRITY_VECTOR_INDEX || "scholar_integrity_vectors" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; institution?: string; limit?: number };
    const text = String(body.text || "").trim();
    if (text.length < 40) return NextResponse.json({ error: "Add at least 40 characters for semantic retrieval." }, { status: 400 });
    const provider = configuredEmbeddingProvider();
    if (!provider) return NextResponse.json({ error: "Semantic embeddings are not configured. Add HF_TOKEN (or HUGGINGFACE_API_KEY) and, if needed, INTEGRITY_EMBEDDING_MODEL and INTEGRITY_EMBEDDING_DIMENSIONS." }, { status: 503 });
    await connectMongoDB();
    const corpus = {
      async search(vector: number[], options: { limit?: number; institution?: string } = {}) {
        const pipeline = atlasVectorPipeline(vector, { index: process.env.INTEGRITY_VECTOR_INDEX || "scholar_integrity_vectors", limit: options.limit, institution: options.institution });
        const docs = await CorpusSource.aggregate(pipeline).exec();
        return docs.map((doc: Record<string, unknown>) => ({ id: String(doc._id), title: String(doc.title || "Corpus source"), text: String(doc.text || ""), url: doc.url ? String(doc.url) : undefined, score: Number(doc.score || 0) }));
      },
    };
    const candidates = await semanticCandidates(text, provider, corpus, { limit: Math.min(Math.max(Number(body.limit) || 20, 1), 50), institution: String(body.institution || "").trim() || undefined });
    return NextResponse.json({ model: provider.model, dimensions: provider.dimensions, candidates }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Semantic integrity retrieval failed", error);
    return NextResponse.json({ error: "Semantic retrieval could not run. Confirm the embedding credentials, embedding dimensions and Atlas vector index configuration." }, { status: 500 });
  }
}
