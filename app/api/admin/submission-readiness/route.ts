import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { calculateSubmissionReadiness, READINESS_CHECKS } from "@/lib/submission-readiness";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const clientName = String(body.clientName ?? "").trim();
    const manuscriptTitle = String(body.manuscriptTitle ?? "").trim();
    const targetJournal = String(body.targetJournal ?? "").trim();
    const completedIds = Array.isArray(body.completedIds) ? body.completedIds.map(String) : [];
    const result = calculateSubmissionReadiness(completedIds);

    const prompt = `You are a senior academic publishing operations editor. Produce a concise final submission risk memo from a deterministic readiness checklist. Do not invent manuscript facts, journal policies, indexing, fees, ethics approvals, or acceptance likelihood. Never override missing critical checks.\n\nCLIENT: ${clientName || "Not supplied"}\nMANUSCRIPT: ${manuscriptTitle || "Not supplied"}\nTARGET JOURNAL: ${targetJournal || "Not supplied"}\nDECISION: ${result.decision}\nSCORE: ${result.score}/100\nCATEGORY SCORES: ${JSON.stringify(result.categoryScores)}\nCRITICAL FAILURES: ${result.criticalFailures.map((item) => item.label).join("; ") || "None"}\nMISSING CHECKS: ${result.missing.map((item) => item.label).join("; ") || "None"}\n\nReturn sections: Decision, Critical blockers, Work required before submission, Final publisher verification, Client-facing message. Make the distinction between verified checklist completion and facts that still require official journal/author confirmation.`;

    const ai = await generateWithAiFallback(prompt);
    return NextResponse.json({
      ...result,
      checklist: READINESS_CHECKS,
      aiMemo: ai?.text ?? null,
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submission readiness assessment failed." }, { status: 500 });
  }
}
