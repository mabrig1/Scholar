import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { assessHighImpactReadiness, fetchRelatedHighSignalWork, type HighImpactInput } from "@/lib/high-impact-accelerator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json();
    const clientName = String(body.clientName ?? "").trim();
    const title = String(body.title ?? "").trim();
    const field = String(body.field ?? "").trim();
    const articleType = String(body.articleType ?? "Original research article").trim();
    const abstract = String(body.abstract ?? "").trim();
    const manuscriptText = String(body.manuscriptText ?? "").trim();
    const targetGoal = String(body.targetGoal ?? "Selective reputable journal").trim();
    if (!clientName || !title || abstract.length < 80) {
      return NextResponse.json({ error: "Enter the lecturer/client name, manuscript title and an abstract of at least 80 characters." }, { status: 400 });
    }

    const seed: HighImpactInput = {
      clientName, title, abstract, field, articleType,
      studyDesign: "", noveltyClaim: "", mainFinding: "", methodsSummary: manuscriptText.slice(0, 3000),
      manuscriptText, targetJournals: [], authorCountry: "Nigeria", fundingStatus: "Not specified",
    };
    const baseline = assessHighImpactReadiness(seed);
    const relatedWorks = await fetchRelatedHighSignalWork([title, field, abstract.slice(0, 350)].filter(Boolean).join(" "));

    const prompt = `You are Mabrig Researcher Pro High-Impact Autopilot, a private publisher tool serving African lecturers and researchers. Your task is to make a manuscript more competitive for selective reputable journals with minimal manual effort. Never fabricate findings, sample sizes, statistics, citations, journal metrics, JIF, quartiles, indexing, acceptance rates or peer review. Never promise publication. If information is missing, state what the author must supply or verify.\n\nCLIENT: ${clientName}\nTARGET GOAL: ${targetGoal}\nFIELD: ${field}\nARTICLE TYPE: ${articleType}\nTITLE: ${title}\nABSTRACT: ${abstract}\nMANUSCRIPT TEXT/EXCERPT: ${manuscriptText.slice(0, 12000)}\nBASELINE STRUCTURED READINESS: ${JSON.stringify(baseline)}\nRELATED SCHOLARLY LANDSCAPE FROM OPENALEX: ${JSON.stringify(relatedWorks.slice(0, 12))}\n\nProduce a highly practical publisher-facing plan with exactly these sections:\n1. SELECTIVE EDITOR SIMULATION — 30-second desk decision and the 5 reasons an editor may reject or continue.\n2. METHODS & STATISTICS REVIEW — identify design, sampling, measurement, analysis, uncertainty, robustness, ethics and reproducibility gaps; never invent missing values.\n3. PEER REVIEWER SIMULATION — Major Comments and Minor Comments.\n4. NOVELTY EXTRACTION — infer the strongest defensible contribution from supplied text, then clearly label any claim needing author verification.\n5. SIGNIFICANCE TEST — explain why the result matters beyond the local sample/context and how to avoid overclaiming generalizability.\n6. LITERATURE-GAP MAP — show what the manuscript must establish against the related-work landscape; never invent citations.\n7. TITLE UPGRADE — give 5 stronger title options faithful to the supplied study.\n8. ABSTRACT UPGRADE BLUEPRINT — sentence-by-sentence structure showing what should appear; do not invent results.\n9. FIGURE/TABLE PRIORITY — recommend the 3–5 displays most likely to make the argument clear, based only on supplied data/design.\n10. HIGH-IMPACT JOURNAL LADDER — describe Ambitious / Strong-fit / Safer-backup selection criteria and suggest candidate journal names only when supported by supplied related-work evidence; proprietary metrics must be manually verified.\n11. EDITOR COVER-LETTER PITCH — concise draft focused on problem, gap, method, main contribution and journal fit; insert [AUTHOR TO VERIFY] where facts are missing.\n12. 7-DAY UPGRADE SPRINT — Day 1 through Day 7, ordered by highest rejection risk first.\n13. FINAL DECISION — GO TO JOURNAL TARGETING / REVISE FIRST / HOLD, with 5 gating conditions.\n\nWrite for a professional publisher who will turn the output into a premium service package. Be decisive, concise, and technically demanding.`;

    const ai = await generateWithAiFallback(prompt);
    if (!ai?.text) {
      return NextResponse.json({
        baseline,
        relatedWorks,
        autopilotReport: null,
        aiProvider: null,
        aiModel: null,
        fallbackActions: baseline.dimensions.flatMap(d => d.actions.map(action => `${d.label}: ${action}`)).slice(0, 15),
        generatedAt: new Date().toISOString(),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({
      baseline,
      relatedWorks,
      autopilotReport: ai.text,
      aiProvider: ai.provider,
      aiModel: ai.model,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "High-impact autopilot failed." }, { status: 500 });
  }
}
