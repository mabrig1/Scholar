import { NextResponse } from "next/server";
import { discoverAcademicSources } from "@/lib/academic-source-discovery";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; query?: string };
    const raw = String(body.query || body.text || "").replace(/\s+/g," ").trim();
    if (raw.length < 20) return NextResponse.json({ error: "Add enough academic text or a topic to discover sources." }, { status: 400 });
    const query = raw.slice(0, 600);
    const sources = await discoverAcademicSources(query, 8);
    return NextResponse.json({ query, sources, note: "OpenAlex and Crossref discovery returns bibliographic candidates. Only sources with retrievable abstract text can participate directly in passage similarity; metadata-only results are evidence leads, not similarity matches." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Academic source discovery failed", error);
    return NextResponse.json({ error: "Unable to discover academic sources right now." }, { status: 500 });
  }
}
