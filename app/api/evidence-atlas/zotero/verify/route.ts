import { NextRequest, NextResponse } from "next/server";
import { crossrefItemToArticle, normalizeDoi } from "@/lib/scholarly-articles";
import { rateLimit } from "@/lib/security";
import { normalizeZoteroDoi } from "@/packages/evidence-atlas-core/src/zotero-public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms exact DOI bibliographic registration before user chooses Save Paper. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, "atlas:zotero:verify", 18, 10 * 60_000);
  if (limited) return limited;
  const rawDoi = request.nextUrl.searchParams.get("doi") || "";
  const doi = normalizeZoteroDoi(rawDoi);
  if (!doi || rawDoi.length > 260) {
    return NextResponse.json({ error: "Provide one valid DOI." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const url = new URL("https://api.crossref.org/works/" + encodeURIComponent(doi));
    const response = await fetch(url, {
      method: "GET", redirect: "error", cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "MABRIG-Scholar-Evidence-Atlas/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404) return NextResponse.json({
      error: "DOI was not found in Crossref. This preview cannot import it as a Crossref-verified paper.",
    }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    if (!response.ok) throw new Error("Crossref provider error.");
    const body = await response.text();
    if (body.length > 400_000) throw new Error("Registry response too large.");
    const payload = JSON.parse(body);
    const article = crossrefItemToArticle(payload?.message);
    if (!article || normalizeDoi(article.doi) !== doi) {
      return NextResponse.json({ error: "Crossref did not confirm an exact matching DOI record." },
        { status: 422, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({
      article,
      verification: "Exact DOI metadata returned by Crossref; this does not verify findings, journal quality or retraction status.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Crossref DOI verification is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
