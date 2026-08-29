import { NextResponse } from "next/server";
import { discoverAcademicSources } from "@/lib/academic-source-discovery";

export const runtime = "nodejs";
export const maxDuration = 30;

async function runDiscovery(rawValue: string) {
  const raw = rawValue.replace(/\s+/g, " ").trim();
  if (raw.length < 20) return NextResponse.json({ error: "Add enough academic text or a topic to discover sources." }, { status: 400 });
  const query = raw.slice(0, 600);
  const candidates = await discoverAcademicSources(query, 8);
  const results = candidates.map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    url: item.url,
    doi: item.doi,
    provider: item.provider,
    text: item.abstract,
  }));
  return NextResponse.json({
    query,
    results,
    sources: results,
    note: "OpenAlex and Crossref return bibliographic candidates. Only records with retrievable abstract text participate directly in passage similarity; metadata-only records are research leads, not plagiarism evidence.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return await runDiscovery(String(url.searchParams.get("q") || ""));
  } catch (error) {
    console.error("Academic source discovery failed", error);
    return NextResponse.json({ error: "Unable to discover academic sources right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; query?: string };
    return await runDiscovery(String(body.query || body.text || ""));
  } catch (error) {
    console.error("Academic source discovery failed", error);
    return NextResponse.json({ error: "Unable to discover academic sources right now." }, { status: 500 });
  }
}
