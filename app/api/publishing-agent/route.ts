import { NextRequest, NextResponse } from "next/server";
import { generateWithAiFallback } from "@/lib/ai-provider";
import { buildPublishingPlan, type PublishingAgentInput } from "@/lib/publishing-agent";

export const runtime = "nodejs";

const allowedBudgets = new Set(["zero", "low", "moderate", "flexible"]);
const allowedGoals = new Set(["scopus", "verified", "either"]);
const allowedStages = new Set(["idea", "draft", "complete", "revising"]);

function normalizeInput(body: Record<string, unknown>): PublishingAgentInput {
  const budget = String(body.budget ?? "zero") as PublishingAgentInput["budget"];
  const indexingGoal = String(body.indexingGoal ?? "scopus") as PublishingAgentInput["indexingGoal"];
  const studyStage = String(body.studyStage ?? "complete") as PublishingAgentInput["studyStage"];
  return {
    title: String(body.title ?? "").trim(),
    abstract: String(body.abstract ?? "").trim(),
    keywords: String(body.keywords ?? "").trim(),
    field: String(body.field ?? "").trim(),
    articleType: String(body.articleType ?? "Original research article").trim(),
    budget: allowedBudgets.has(budget) ? budget : "zero",
    indexingGoal: allowedGoals.has(indexingGoal) ? indexingGoal : "scopus",
    studyStage: allowedStages.has(studyStage) ? studyStage : "complete",
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = normalizeInput(await request.json());
    if (!input.title || input.title.length < 12) {
      return NextResponse.json({ error: "Enter a clear manuscript title of at least 12 characters." }, { status: 400 });
    }
    if (input.abstract.length < 120) {
      return NextResponse.json({ error: "Paste an abstract of at least 120 characters so the agent can assess fit." }, { status: 400 });
    }

    const plan = buildPublishingPlan(input);
    const prompt = `You are Mabrig Researcher Pro's ethical academic publishing strategist. Produce a concise manuscript-specific technical briefing from the supplied deterministic plan. Do not invent Scopus status, quartiles, metrics, fees, acceptance rates, turnaround times, citations, or journal policies. Never promise acceptance or indexing. Treat every candidate as requiring same-day verification in Scopus Sources and on the official journal site. Prioritize minimal cost without sacrificing scope and methodological fit.

MANUSCRIPT
${JSON.stringify(input, null, 2)}

STRUCTURED PLAN
${JSON.stringify({ readiness: plan.readiness, pathway: plan.pathway, candidates: plan.candidates, costPlan: plan.costPlan }, null, 2)}

Return five short sections: Technical diagnosis; Best journal ladder; Lowest-cost route; Corrections before submission; Final verification gate. Explain why each shortlisted journal may fit, but explicitly require official verification.`;
    const ai = await generateWithAiFallback(prompt);

    return NextResponse.json({
      ...plan,
      aiBriefing: ai?.text ?? null,
      aiEnabled: Boolean(ai?.text),
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      generatedAt: new Date().toISOString(),
      integrityNotice: "This agent supports legitimate preparation and verification. It does not guarantee acceptance, Scopus indexing, peer-review outcomes or a fixed publication cost.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The publishing agent could not prepare a plan." },
      { status: 500 },
    );
  }
}
