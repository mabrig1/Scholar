import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { searchOpenAlexSources, verifyCrossrefIssn, type Journal } from "@/lib/journals";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSimilarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const bb = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection++;
  return intersection / Math.max(aa.size, bb.size);
}

async function resolveJournal(name: string): Promise<Journal | null> {
  try {
    const results = await searchOpenAlexSources(name, 8);
    if (!results.length) return null;
    const exact = results.find((journal) => normalize(journal.name) === normalize(name));
    if (exact) return exact;
    return [...results].sort((a, b) => tokenSimilarity(name, b.name) - tokenSimilarity(name, a.name))[0] ?? null;
  } catch {
    return null;
  }
}

async function topicEvidence(journal: Journal, query: string) {
  const sourceId = journal.id.split("/").pop();
  if (!sourceId) return { relatedWorks: 0, sampledTitles: [] as string[] };
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", query.slice(0, 500));
    url.searchParams.set("filter", `primary_location.source.id:${sourceId},type:article`);
    url.searchParams.set("per-page", "10");
    if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await fetch(url, {
      headers: { "User-Agent": "MabrigResearcherPro/0.7 (journal target decision matrix)" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) return { relatedWorks: 0, sampledTitles: [] as string[] };
    const data = await response.json();
    return {
      relatedWorks: Array.isArray(data.results) ? data.results.length : 0,
      sampledTitles: (data.results ?? []).slice(0, 5).map((work: any) => String(work.display_name || "")).filter(Boolean),
    };
  } catch {
    return { relatedWorks: 0, sampledTitles: [] as string[] };
  }
}

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const abstract = String(body.abstract ?? "").trim();
    const field = String(body.field ?? "").trim();
    const candidateNames = Array.isArray(body.candidates)
      ? body.candidates.map(String).map((item: string) => item.trim()).filter(Boolean).slice(0, 6)
      : [];

    if (!title || abstract.length < 80) {
      return NextResponse.json({ error: "Provide a manuscript title and an abstract of at least 80 characters." }, { status: 400 });
    }
    if (candidateNames.length < 2) {
      return NextResponse.json({ error: "Enter at least two journal candidates to compare." }, { status: 400 });
    }

    const searchQuery = [title, field, abstract.slice(0, 300)].filter(Boolean).join(" ");
    const rows = [] as any[];

    for (const requestedName of candidateNames) {
      const journal = await resolveJournal(requestedName);
      if (!journal) {
        rows.push({ requestedName, resolved: false, warning: "No matching OpenAlex journal source was resolved automatically." });
        continue;
      }
      const [topic, crossref] = await Promise.all([
        topicEvidence(journal, searchQuery),
        journal.issnL ? verifyCrossrefIssn(journal.issnL) : (journal.issn[0] ? verifyCrossrefIssn(journal.issn[0]) : Promise.resolve(null)),
      ]);
      rows.push({
        requestedName,
        resolved: true,
        journal,
        topic,
        crossref,
        evidenceScore: Math.min(100,
          (topic.relatedWorks * 5)
          + (journal.isInDoaj ? 15 : 0)
          + (crossref ? 10 : 0)
          + (journal.issn.length ? 8 : 0)
          + (journal.hIndex ? Math.min(20, journal.hIndex / 5) : 0)
          + (journal.twoYearMeanCitedness ? Math.min(15, journal.twoYearMeanCitedness * 2) : 0)
        ),
      });
    }

    const prompt = `You are a senior journal-selection strategist. Rank only the supplied registry-derived journal candidates for this manuscript. Do not invent Journal Impact Factor, quartile, Scopus/Web of Science indexing, acceptance rate, turnaround time, APC, waiver, or aims/scope facts. Treat OpenAlex citation indicators as transparent signals, not Clarivate JIF. Treat topic.relatedWorks as a search-overlap sample, not an acceptance prediction. Require official-site verification before submission/payment.\n\nMANUSCRIPT\nTitle: ${title}\nField: ${field}\nAbstract: ${abstract}\n\nCANDIDATE EVIDENCE\n${JSON.stringify(rows, null, 2)}\n\nReturn sections: 1) Ranked shortlist, 2) Why each candidate fits or does not fit, 3) Cost/open-access questions to verify, 4) Indexing/reputation facts that must be manually verified, 5) Recommended first-choice / backup submission sequence. Be conservative where evidence is missing.`;
    const ai = await generateWithAiFallback(prompt);

    return NextResponse.json({
      manuscript: { title, field },
      rows,
      aiAnalysis: ai?.text ?? null,
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      generatedAt: new Date().toISOString(),
      notice: "The matrix compares live registry evidence and topic-overlap samples. It does not establish proprietary indexing, impact factor, journal quartile, acceptance probability, fee guarantees, or publication outcome. Confirm final journal claims on official/licensed sources.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Journal decision matrix failed." }, { status: 500 });
  }
}
