import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { assessHighImpactReadiness, fetchRelatedHighSignalWork, verifyTargetJournals, type HighImpactInput } from "@/lib/high-impact-accelerator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json();
    const input: HighImpactInput = {
      clientName: String(body.clientName ?? "").trim(),
      title: String(body.title ?? "").trim(),
      abstract: String(body.abstract ?? "").trim(),
      field: String(body.field ?? "").trim(),
      articleType: String(body.articleType ?? "Original research article").trim(),
      studyDesign: String(body.studyDesign ?? "").trim(),
      noveltyClaim: String(body.noveltyClaim ?? "").trim(),
      mainFinding: String(body.mainFinding ?? "").trim(),
      methodsSummary: String(body.methodsSummary ?? "").trim(),
      manuscriptText: String(body.manuscriptText ?? "").trim(),
      targetJournals: Array.isArray(body.targetJournals) ? body.targetJournals.map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 6) : [],
      authorCountry: String(body.authorCountry ?? "").trim(),
      fundingStatus: String(body.fundingStatus ?? "").trim(),
    };
    if (!input.clientName || !input.title || input.abstract.length < 80) {
      return NextResponse.json({ error: "Provide the client name, manuscript title and an abstract of at least 80 characters." }, { status: 400 });
    }

    const assessment = assessHighImpactReadiness(input);
    const searchText = [input.title, input.field, input.noveltyClaim, input.abstract.slice(0, 280)].filter(Boolean).join(" ");
    const relatedWorks = await fetchRelatedHighSignalWork(searchText);
    const discoveredTargets = [...new Set(relatedWorks.map((work) => work.journal).filter((value): value is string => Boolean(value)))].slice(0, 6);
    const journalsToCheck = input.targetJournals.length ? input.targetJournals : discoveredTargets;
    const journalChecks = await verifyTargetJournals(journalsToCheck);
    const journalDiscoveryMode = input.targetJournals.length ? "publisher-supplied candidates" : "automatically discovered from related scholarly work";

    const prompt = `You are Mabrig Researcher Pro's High-Impact Publication Accelerator for an ethical professional academic publisher serving African researchers. Produce a publisher-facing upgrade strategy that increases the manuscript's competitiveness for selective reputable journals without fabricating data, citations, indexing, metrics, acceptance probabilities or peer review. Never promise publication. Never call a journal high-impact solely from OpenAlex h-index/2yr citedness; official Journal Impact Factor/JCR/Scopus/WoS claims require licensed or official verification.\n\nCLIENT: ${input.clientName}\nFIELD: ${input.field}\nARTICLE TYPE: ${input.articleType}\nSTUDY DESIGN: ${input.studyDesign}\nTITLE: ${input.title}\nABSTRACT: ${input.abstract}\nNOVELTY CLAIM: ${input.noveltyClaim}\nMAIN FINDING: ${input.mainFinding}\nMETHODS SUMMARY: ${input.methodsSummary}\nMANUSCRIPT EXCERPT: ${input.manuscriptText.slice(0, 9000)}\nAUTHOR COUNTRY: ${input.authorCountry}\nFUNDING STATUS: ${input.fundingStatus}\n\nSTRUCTURED READINESS: ${JSON.stringify(assessment)}\nJOURNAL DISCOVERY MODE: ${journalDiscoveryMode}\nTARGET-JOURNAL DUE DILIGENCE: ${JSON.stringify(journalChecks)}\nRELATED SCHOLARLY LANDSCAPE: ${JSON.stringify(relatedWorks)}\n\nWrite these sections:\n1. Editor's 30-Second Verdict\n2. What Prevents This From Competing at a Higher Journal Tier\n3. Novelty & Significance Upgrade\n4. Methods / Statistics / Evidence Upgrade\n5. Reporting-Guideline Compliance Plan\n6. Title & Abstract Rewrite Strategy (give 3 improved title options, but do not alter findings)\n7. Literature Positioning & Citation-Gap Strategy\n8. High-Impact Journal Ladder: Ambitious / Strong Fit / Safer Backup (use only supplied/verified evidence; if insufficient, say verification required)\n9. Anti-Scam Journal Due-Diligence Checklist\n10. APC / Waiver / Funding Strategy\n11. Cover-Letter Editor Pitch (concise draft)\n12. Desk-Rejection Prevention Checklist\n13. 14-Day Publisher Action Plan\n14. Final GO / REVISE / DO NOT SUBMIT recommendation.\n\nBe specific and commercially useful. Preserve scholarly integrity and never invent a citation, statistic, result, impact factor, quartile or indexing status.`;

    const ai = await generateWithAiFallback(prompt);
    return NextResponse.json({
      assessment,
      relatedWorks,
      journalChecks,
      journalDiscoveryMode,
      aiReport: ai?.text ?? null,
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "High-impact accelerator failed." }, { status: 500 });
  }
}
