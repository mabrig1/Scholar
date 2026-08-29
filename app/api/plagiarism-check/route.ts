import { NextResponse } from "next/server";
import { compareAgainstCorpus } from "@/lib/plagiarism-detector";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; sources?: Array<{ id?: string; title?: string; text?: string; url?: string }> };
    const text = String(body.text || "").trim();
    if (text.length < 100) return NextResponse.json({ error: "Paste at least 100 characters to check." }, { status: 400 });
    if (text.length > 150_000) return NextResponse.json({ error: "Check a maximum of 150,000 characters at a time." }, { status: 413 });
    const sources = (body.sources || []).filter(s => String(s.text || "").trim().length >= 50).slice(0, 250).map((s, i) => ({ id: String(s.id || i + 1), title: String(s.title || `Reference ${i + 1}`).slice(0, 300), text: String(s.text || "").slice(0, 250_000), url: s.url ? String(s.url).slice(0, 1000) : undefined }));
    if (!sources.length) return NextResponse.json({ error: "Add at least one reference source. Scholar reports only evidence-backed matches." }, { status: 400 });
    return NextResponse.json(compareAgainstCorpus(text, sources), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Similarity check failed", error);
    return NextResponse.json({ error: "Unable to complete the similarity check." }, { status: 500 });
  }
}
