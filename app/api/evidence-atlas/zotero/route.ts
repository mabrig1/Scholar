import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security";
import {
  parseZoteroPublicItems, parseZoteroPublicRequest, zoteroPublicItemsUrl,
} from "@/packages/evidence-atlas-core/src/zotero-public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Zotero bibliography metadata ONLY. No API keys, account credentials,
 * private library fetches, attachments, syncing or arbitrary target URL.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, "atlas:zotero:public", 10, 10 * 60_000);
  if (limited) return limited;
  let library;
  try {
    library = parseZoteroPublicRequest(request.nextUrl.searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid library selection." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const response = await fetch(zoteroPublicItemsUrl(library), {
      method: "GET", redirect: "error", cache: "no-store",
      headers: { Accept: "application/json", "Zotero-API-Version": "3",
        "User-Agent": "MABRIG-Scholar-Evidence-Atlas/1.0 (public-library-preview)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 403 || response.status === 401) {
      return NextResponse.json({ error: "The library is not publicly readable. Private Zotero access is not enabled." },
        { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    if (response.status === 404) {
      return NextResponse.json({ error: "Public Zotero library or collection was not found." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    if (!response.ok) {
      return NextResponse.json({ error: "Zotero is temporarily unavailable or is rate limiting this request." },
        { status: 502, headers: { "Cache-Control": "private, no-store" } });
    }
    // Bound upstream response before JSON parsing.
    const text = await response.text();
    if (text.length > 400_000) throw new Error("Zotero response is too large.");
    const parsed = parseZoteroPublicItems(JSON.parse(text));
    return NextResponse.json({
      libraryType: library.libraryType,
      libraryId: library.libraryId,
      collectionKey: library.collectionKey || null,
      checkedAt: new Date().toISOString(),
      ...parsed,
      disclaimer: "Public Zotero metadata is unverified. Importing requires a separate exact DOI check against Crossref.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve public Zotero bibliography metadata." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
