import { NextRequest, NextResponse } from "next/server";
import {
  crossrefItemToArticle,
  deduplicateArticlesByTitle,
  reconstructOpenAlexAbstract,
  type ScholarlyArticle,
} from "@/lib/scholarly-articles";

export const runtime = "nodejs";

function requestHeaders() {
  const email = process.env.CROSSREF_MAILTO?.trim();
  return {
    Accept: "application/json",
    "User-Agent": `Mabrig-Researcher-Pro/1.0${email ? ` (mailto:${email})` : ""}`,
  };
}

async function enrichFromOpenAlex(article: ScholarlyArticle) {
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", `doi:https://doi.org/${article.doi}`);
    url.searchParams.set("per-page", "1");
    url.searchParams.set("select", "id,doi,title,is_retracted,cited_by_count,open_access,abstract_inverted_index");
    if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return article;
    const result = (await response.json())?.results?.[0];
    if (!result?.id) return article;
    return {
      ...article,
      abstract: article.abstract || reconstructOpenAlexAbstract(result.abstract_inverted_index),
      citationCount: Math.max(article.citationCount, Number(result.cited_by_count) || 0),
      openAccess: typeof result.open_access?.is_oa === "boolean" ? result.open_access.is_oa : article.openAccess,
      openAlexId: String(result.id),
      retracted: Boolean(result.is_retracted),
      verification: "crossref-openalex" as const,
    };
  } catch {
    return article;
  }
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const currentYear = new Date().getUTCFullYear();
    const fromYear = Math.max(1900, Math.min(currentYear, Number(request.nextUrl.searchParams.get("from")) || currentYear - 5));
    const toYear = Math.max(fromYear, Math.min(currentYear, Number(request.nextUrl.searchParams.get("to")) || currentYear));
    const rows = Math.max(5, Math.min(20, Number(request.nextUrl.searchParams.get("rows")) || 10));
    if (query.length < 4) return NextResponse.json({ error: "Enter a research topic of at least four characters." }, { status: 400 });
    if (query.length > 300) return NextResponse.json({ error: "The search topic is too long." }, { status: 400 });

    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.bibliographic", query);
    url.searchParams.set("filter", `from-pub-date:${fromYear}-01-01,until-pub-date:${toYear}-12-31,type:journal-article`);
    url.searchParams.set("select", "DOI,title,author,published,published-print,published-online,issued,created,container-title,publisher,URL,abstract,volume,issue,page,article-number,is-referenced-by-count");
    url.searchParams.set("rows", String(Math.min(50, rows * 2)));
    url.searchParams.set("sort", "relevance");
    const mailto = process.env.CROSSREF_MAILTO?.trim();
    if (mailto) url.searchParams.set("mailto", mailto);

    const response = await fetch(url, { headers: requestHeaders(), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return NextResponse.json({ error: "The scholarly registry is temporarily unavailable. Please try again." }, { status: 502 });
    const items = (await response.json())?.message?.items;
    const registered = Array.isArray(items)
      ? items.map(crossrefItemToArticle).filter((article): article is ScholarlyArticle => Boolean(article))
      : [];
    const unique = deduplicateArticlesByTitle(registered, rows);
    const articles = await Promise.all(unique.map(enrichFromOpenAlex));

    return NextResponse.json({
      query,
      fromYear,
      toYear,
      articles,
      count: articles.length,
      verifiedAt: new Date().toISOString(),
      verificationGuide: {
        crossref: "DOI and bibliographic metadata found in the Crossref registry.",
        "crossref-openalex": "DOI metadata found in Crossref and the work independently indexed by OpenAlex.",
      },
    }, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    console.error("Scholarly search failed", error);
    return NextResponse.json({ error: "Unable to search scholarly articles right now." }, { status: 500 });
  }
}
