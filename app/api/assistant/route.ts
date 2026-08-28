import { NextRequest, NextResponse } from "next/server";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { normalizeOpenAlexSource, type Journal } from "@/lib/journals";

export const runtime = "nodejs";

type Work = {
  primary_location?: { source?: Parameters<typeof normalizeOpenAlexSource>[0] | null } | null;
};

async function findCandidateJournals(searchText: string): Promise<Journal[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", searchText.slice(0, 650));
  url.searchParams.set("filter", "type:article");
  url.searchParams.set("per-page", "40");

  const response = await fetch(url, {
    headers: { "User-Agent": "MabrigResearcherPro/0.3 (journal matching app)" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`OpenAlex matching failed (${response.status})`);

  const data = await response.json();
  const counts = new Map<string, { count: number; source: Parameters<typeof normalizeOpenAlexSource>[0] }>();

  for (const work of (data.results ?? []) as Work[]) {
    const source = work.primary_location?.source;
    if (!source?.id || !source.display_name || source.type !== "journal") continue;
    const current = counts.get(source.id);
    counts.set(source.id, { count: (current?.count ?? 0) + 1, source });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((entry) => normalizeOpenAlexSource(entry.source));
}

async function generateAiAdvice(input: {
  title: string;
  abstract: string;
  keywords: string;
  field: string;
  candidates: Journal[];
}) {
  const prompt = `You are an academic journal submission strategist. Help the author improve publication readiness and choose among registry-derived candidate journals. Never invent impact factors, acceptance rates, indexing, APCs, turnaround times, or submission requirements. If a fact is not in the supplied data, say it must be checked on the official journal site. Do not write a paper for the author; provide ethical editorial assistance, targeting advice, and a submission checklist.

MANUSCRIPT
Title: ${input.title}
Field: ${input.field}
Keywords: ${input.keywords}
Abstract: ${input.abstract}

REGISTRY-DERIVED CANDIDATES
${JSON.stringify(input.candidates.slice(0, 8), null, 2)}

Return concise sections: Readiness diagnosis, Best-fit candidates (rank 3-5 with rationale), Manuscript improvements, Submission checklist, and Red flags to verify.`;

  return generateWithAiFallback(prompt);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const abstract = String(body.abstract ?? "").trim();
    const keywords = String(body.keywords ?? "").trim();
    const field = String(body.field ?? "").trim();

    if (!title || abstract.length < 80) {
      return NextResponse.json({ error: "Provide a manuscript title and an abstract of at least 80 characters." }, { status: 400 });
    }

    const searchText = [title, keywords, field, abstract.slice(0, 300)].filter(Boolean).join(" ");
    const candidates = await findCandidateJournals(searchText);
    const ai = await generateAiAdvice({ title, abstract, keywords, field, candidates });

    return NextResponse.json({
      candidates,
      aiAdvice: ai?.text ?? null,
      aiEnabled: Boolean(ai?.text),
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      readiness: {
        abstractLength: abstract.length,
        hasKeywords: keywords.split(",").filter((k: string) => k.trim()).length >= 3,
        hasField: Boolean(field),
      },
      fallbackAdvice: [
        "Check that the title states the core problem, population/context, and main relationship or contribution clearly.",
        "Confirm the abstract contains background, objective, method, key results, and conclusion where your discipline expects them.",
        "Shortlist journals whose recent articles closely overlap your topic before checking aims, scope, author guidelines, fees, and indexing on the official site.",
        "Prepare a cover letter that explains novelty and journal fit without overstating the findings.",
        "Run references, ethics statements, authorship declarations, figures, tables, and reporting-guideline checks before submission.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI publishing assistant failed." },
      { status: 500 },
    );
  }
}
