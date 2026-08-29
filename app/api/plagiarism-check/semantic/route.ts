import { NextResponse } from "next/server";
import { embeddingStatus } from "@/lib/integrity-embeddings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ...embeddingStatus(),
    index: process.env.INTEGRITY_VECTOR_INDEX || "scholar_integrity_vectors",
    retrieval: "server-side",
    privacy: "Only sources separately approved for anonymous comparison are eligible.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
