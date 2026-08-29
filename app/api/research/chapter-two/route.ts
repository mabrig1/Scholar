import { NextResponse } from "next/server";
import { generateWithAiFallback } from "@/lib/ai-provider";
import {
  apa7Reference,
  buildChapterTwoOutline,
  crossrefItemToArticle,
  normalizeDoi,
  reconstructOpenAlexAbstract,
  type ScholarlyArticle,
} from "@/lib/scholarly-articles";

export const runtime = "nodejs";

const MAX_ARTICLES = 12;

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

async function verifyDoi(value: unknown): Promise<ScholarlyArticle | null> {
  const doi = normalizeDoi(value);
  if (!doi) return null;
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mabrig-Researcher-Pro/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const registered = crossrefItemToArticle((await response.json())?.message);
    if (!registered) return null;
    try {
      const openAlexUrl = new URL("https://api.openalex.org/works");
      openAlexUrl.searchParams.set("filter", `doi:https://doi.org/${registered.doi}`);
      openAlexUrl.searchParams.set("per-page", "1");
      openAlexUrl.searchParams.set("select", "id,is_retracted,abstract_inverted_index");
      if (process.env.OPENALEX_API_KEY) openAlexUrl.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
      const openAlexResponse = await fetch(openAlexUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!openAlexResponse.ok) return registered;
      const openAlex = (await openAlexResponse.json())?.results?.[0];
      if (!openAlex?.id || openAlex.is_retracted) return openAlex?.is_retracted ? { ...registered, retracted: true } : registered;
      return {
        ...registered,
        abstract: registered.abstract || reconstructOpenAlexAbstract(openAlex.abstract_inverted_index),
        openAlexId: String(openAlex.id),
        verification: "crossref-openalex",
      };
    } catch {
      return registered;
    }
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const topic = clean(body.topic, 300);
    const concepts = clean(body.concepts, 600);
    const theories = clean(body.theories, 600);
    const objectives = clean(body.objectives, 1_500);
    const requested = Array.isArray(body.articles) ? body.articles.slice(0, MAX_ARTICLES) : [];
    if (topic.length < 12) return NextResponse.json({ error: "Enter a complete study topic of at least 12 characters." }, { status: 400 });
    if (requested.length < 3) return NextResponse.json({ error: "Select at least three DOI-verified articles." }, { status: 400 });

    const verified = (await Promise.all(requested.map((article) => verifyDoi((article as Record<string, unknown>)?.doi))))
      .filter((article): article is ScholarlyArticle => article !== null && !article.retracted);
    if (verified.length < 3) return NextResponse.json({ error: "Fewer than three selected DOI records could be reverified. Search again and replace unavailable sources." }, { status: 422 });

    const outline = buildChapterTwoOutline({ topic, concepts, theories, objectives }, verified);
    const evidence = verified.map((article, index) => ({
      number: index + 1,
      citation: apa7Reference(article),
      doi: article.doi,
      abstractAvailable: Boolean(article.abstract),
      evidence: article.abstract || "No abstract was available in the registry; consult the full article before stating its methods or findings.",
    }));
    const prompt = `You are the evidence-bound Chapter Two writing agent for Mabrig Researcher Pro. Draft a rigorous literature review in formal academic English. Use ONLY the supplied DOI-reverified sources. Never invent an author, year, theory originator, method, sample, finding, location, quotation or reference. If evidence is absent from an indexed abstract, write a clearly marked [FULL-TEXT EVIDENCE REQUIRED] instruction instead of guessing. Paraphrase; do not reproduce abstracts. Distinguish conceptual explanation, theoretical argument and empirical evidence. Compare studies instead of listing them. End with a defensible contextual, methodological, theoretical or empirical gap. Every in-text citation must correspond exactly to a supplied reference. The draft is a researcher-editable foundation, not a finished submission.

STUDY TOPIC: ${topic}
CONCEPTS: ${concepts || "Derive cautiously from the topic"}
THEORIES PROPOSED BY RESEARCHER: ${theories || "No theory supplied; provide selection criteria without inventing an originator"}
OBJECTIVES/QUESTIONS: ${objectives || "Not supplied"}

VERIFIED EVIDENCE RECORDS:
${JSON.stringify(evidence, null, 2)}

Return these exact Markdown sections: # CHAPTER TWO; # REVIEW OF RELATED LITERATURE; ## 2.1 Introduction; ## 2.2 Conceptual Framework (with numbered concepts); ## 2.3 Theoretical Framework (origin, assumptions, strengths, limitations, application, and justification only when supported); ## 2.4 Review of Previous Empirical Studies (author/year, purpose, design, population/sample, method, findings and limitation only when the abstract supports each detail); ## 2.5 Gap in the Literature; ## 2.6 Summary of Reviewed Literature; ## References. Use APA-style author-date citations and include the supplied DOI URL in every reference.`;
    const ai = await generateWithAiFallback(prompt);
    const draft = ai?.text?.trim() || outline;

    return NextResponse.json({
      draft,
      mode: ai ? "ai-assisted" : "evidence-outline",
      provider: ai?.provider || null,
      model: ai?.model || null,
      articles: verified,
      references: verified.map(apa7Reference).sort(),
      evidenceMatrix: verified.map((article) => ({
        authorYear: article.authors.length ? `${article.authors[0].family}${article.authors.length > 1 ? " et al." : ""} (${article.year})` : `Unknown author (${article.year})`,
        title: article.title,
        journal: article.journal,
        doi: article.doi,
        abstractStatus: article.abstract ? "Indexed abstract available" : "Full-text extraction required",
      })),
      generatedAt: new Date().toISOString(),
      integrityNotice: "Every included DOI was rechecked against Crossref at generation time. Metadata verification confirms that a record exists; it does not replace reading the full paper, assessing study quality, or checking corrections and retractions.",
    });
  } catch (error) {
    console.error("Chapter Two drafting failed", error);
    return NextResponse.json({ error: "Unable to build the Chapter Two evidence draft." }, { status: 500 });
  }
}
