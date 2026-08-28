import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { normalizeOpenAlexSource, type Journal } from "@/lib/journals";
import { buildScholarStrategy } from "@/lib/scholar-strategy";

export const runtime = "nodejs";

type Work = {
  primary_location?: { source?: Parameters<typeof normalizeOpenAlexSource>[0] | null } | null;
};

async function findCandidateJournals(searchText: string): Promise<Journal[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", searchText.slice(0, 650));
  url.searchParams.set("filter", "type:article");
  url.searchParams.set("per-page", "35");
  if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);

  const response = await fetch(url, {
    headers: { "User-Agent": "MabrigResearcherPro/0.4 (Africa-first publisher technical services engine)" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return [];

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
    .slice(0, 8)
    .map((entry) => normalizeOpenAlexSource(entry.source));
}

function fallbackReport(input: {
  clientName: string;
  title: string;
  field: string;
  articleType: string;
  abstract: string;
  targetJournal: string;
  publicationGoal: string;
  services: string[];
  scholarScore: number;
}) {
  const abstractWords = input.abstract.trim().split(/\s+/).filter(Boolean).length;
  const serviceText = input.services.length ? input.services.join(", ") : "General publishing readiness audit";
  return `PUBLISHING TECHNICAL ASSESSMENT\n\nClient: ${input.clientName || "Not supplied"}\nManuscript: ${input.title}\nField: ${input.field || "Not specified"}\nArticle type: ${input.articleType || "Not specified"}\nPrimary visibility goal: ${input.publicationGoal || "Global scholarly visibility"}\nTarget journal: ${input.targetJournal || "Not yet selected"}\n\n1. EXECUTIVE ASSESSMENT\nThe manuscript has an abstract of approximately ${abstractWords} words. Begin with a full technical audit of structure, journal fit, references, declarations, tables/figures, author-guideline compliance and discoverability readiness.\n\n2. PREMIUM SERVICES SELECTED\n${serviceText}\n\n3. PRIORITY TECHNICAL CHECKS\n- Confirm the title accurately reflects the study design, population/context, and main contribution.\n- Ensure the abstract follows the target discipline's expected structure and reports actual methods/results without unsupported claims.\n- Check that every in-text citation has a corresponding reference and vice versa.\n- Verify ethics, consent, funding, conflict-of-interest, data-availability, and author-contribution statements where applicable.\n- Confirm tables, figures, headings, word count, reference style, and supplementary files against the official author guidelines.\n\n4. GOOGLE SCHOLAR & RESEARCH VISIBILITY\nCurrent structured Scholar-readiness score: ${input.scholarScore}/100. Treat this as an internal workflow score, not a Google score. Optimize author identity, venue evidence, bibliographic metadata, the canonical article page, searchable full text, crawler access, legitimate repository distribution and post-publication monitoring. Never promise Google Scholar inclusion or a fixed indexing date.\n\n5. JOURNAL STRATEGY\nUse registry-derived journal candidates as discovery evidence only. Confirm scope, indexing, APCs, waiver rules, editorial policies, recent Google Scholar discoverability and current submission requirements on official sources before recommending payment or submission.\n\n6. CLIENT ACTION PLAN\nComplete the technical audit, return a marked correction list to the client, implement approved formatting/editorial changes, execute the visibility strategy, prepare the final submission package, and retain a checklist showing what was verified.\n\nNo configured AI provider returned a response. Registry matching, Scholar strategy and deterministic technical workflows remain usable.`;
}

async function generateReport(input: {
  clientName: string;
  authorAffiliation: string;
  orcid: string;
  title: string;
  field: string;
  articleType: string;
  abstract: string;
  manuscriptText: string;
  targetJournal: string;
  publicationGoal: string;
  publicationStage: string;
  publicationDate: string;
  doi: string;
  articleUrl: string;
  fullTextUrl: string;
  services: string[];
  candidates: Journal[];
  scholarStrategy: ReturnType<typeof buildScholarStrategy>;
}) {
  const prompt = `You are the private technical publishing engine for a premium Africa-focused academic publishing-support business. Your job is to give the publisher a strategic advantage while protecting scholarly integrity. Be especially strong on journal selection, publication readiness, research discoverability, Google Scholar technical eligibility, metadata, repositories and post-publication troubleshooting.\n\nDo not fabricate research findings, citations, peer review, indexing, impact factors, APCs, acceptance rates or journal policies. Do not promise publication, acceptance, Google Scholar inclusion, ranking or indexing dates. Distinguish editorial/technical assistance from authorship. If a journal/indexing fact is not supplied, require verification on the official source. Google Scholar uses automated crawling and parsing, so frame Scholar work as eligibility/readiness optimization rather than guaranteed indexing.\n\nCLIENT\nName: ${input.clientName || "Not supplied"}\nAffiliation: ${input.authorAffiliation || "Not supplied"}\nORCID: ${input.orcid || "Not supplied"}\nPrimary publishing/visibility goal: ${input.publicationGoal}\nPublication stage: ${input.publicationStage}\n\nMANUSCRIPT\nTitle: ${input.title}\nField: ${input.field}\nArticle type: ${input.articleType}\nTarget journal: ${input.targetJournal || "Not yet selected"}\nPublication date: ${input.publicationDate || "Not yet available"}\nDOI: ${input.doi || "Not yet available"}\nCanonical article URL: ${input.articleUrl || "Not yet available"}\nFull-text/PDF URL: ${input.fullTextUrl || "Not yet available"}\nAbstract: ${input.abstract}\nManuscript excerpt/text: ${input.manuscriptText.slice(0, 9000)}\n\nPREMIUM SERVICES REQUESTED\n${input.services.join("; ") || "General technical publishing audit"}\n\nREGISTRY-DERIVED JOURNAL CANDIDATES\n${JSON.stringify(input.candidates, null, 2)}\n\nSTRUCTURED GOOGLE SCHOLAR / VISIBILITY PLAYBOOK\n${JSON.stringify(input.scholarStrategy, null, 2)}\n\nProduce a practical publisher-facing report with these headings:\n1. Executive Technical Assessment\n2. Critical Problems to Fix Before Submission\n3. Manuscript Structure, Language & Evidence Actions\n4. References, Ethics & Compliance Checks\n5. Journal Matching, Reputation & APC Strategy\n6. Google Scholar & Global Discoverability Strategy\n7. Metadata, DOI, ORCID & Repository Strategy\n8. Premium Service Deliverables to Sell\n9. Submission Package Checklist\n10. Post-Publication Monitoring & Troubleshooting\n11. Client-Facing Action Plan\n12. Facts That Must Be Manually Verified\n\nFor the Scholar section, map the plan in phases and explicitly say what the publisher controls versus what Google controls. If the client's goal is Google Scholar visibility, make that strategy unusually detailed and actionable. Prioritize work in Critical / Important / Polish levels where appropriate.`;

  return generateWithAiFallback(prompt);
}

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientName = String(body.clientName ?? "").trim();
    const authorAffiliation = String(body.authorAffiliation ?? "").trim();
    const orcid = String(body.orcid ?? "").trim();
    const title = String(body.title ?? "").trim();
    const field = String(body.field ?? "").trim();
    const articleType = String(body.articleType ?? "").trim();
    const abstract = String(body.abstract ?? "").trim();
    const manuscriptText = String(body.manuscriptText ?? "").trim();
    const targetJournal = String(body.targetJournal ?? "").trim();
    const publicationGoal = String(body.publicationGoal ?? "Global scholarly visibility").trim();
    const publicationStage = String(body.publicationStage ?? "Manuscript preparation").trim();
    const publicationDate = String(body.publicationDate ?? "").trim();
    const doi = String(body.doi ?? "").trim();
    const articleUrl = String(body.articleUrl ?? "").trim();
    const fullTextUrl = String(body.fullTextUrl ?? "").trim();
    const services = Array.isArray(body.services) ? body.services.map(String).slice(0, 24) : [];

    if (!clientName) {
      return NextResponse.json({ error: "Enter the client/author name so the engine can create a personalized publishing strategy." }, { status: 400 });
    }
    if (!title || abstract.length < 80) {
      return NextResponse.json({ error: "Provide a manuscript title and an abstract of at least 80 characters." }, { status: 400 });
    }

    const scholarStrategy = buildScholarStrategy({
      clientName,
      authorAffiliation,
      orcid,
      title,
      abstract,
      publicationGoal,
      publicationStage,
      targetJournal,
      publicationDate,
      doi,
      articleUrl,
      fullTextUrl,
    });

    const searchText = [title, field, abstract.slice(0, 350)].filter(Boolean).join(" ");
    const candidates = await findCandidateJournals(searchText);
    const ai = await generateReport({
      clientName,
      authorAffiliation,
      orcid,
      title,
      field,
      articleType,
      abstract,
      manuscriptText,
      targetJournal,
      publicationGoal,
      publicationStage,
      publicationDate,
      doi,
      articleUrl,
      fullTextUrl,
      services,
      candidates,
      scholarStrategy,
    });
    const report = ai?.text || fallbackReport({ clientName, title, field, articleType, abstract, targetJournal, publicationGoal, services, scholarScore: scholarStrategy.readinessScore });

    return NextResponse.json({
      report,
      aiEnabled: Boolean(ai?.text),
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      candidates,
      scholarStrategy,
      generatedAt: new Date().toISOString(),
      readiness: {
        abstractCharacters: abstract.length,
        manuscriptCharacters: manuscriptText.length,
        selectedServices: services.length,
        targetJournalSpecified: Boolean(targetJournal),
        scholarReadinessScore: scholarStrategy.readinessScore,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publishing engine failed." },
      { status: 500 },
    );
  }
}
