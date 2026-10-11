import { NextRequest, NextResponse } from "next/server";
import { runResearchMission } from "@/lib/agentic-research";
import { contentLengthTooLarge, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, "research:agent", 10, 10 * 60_000);
    if (limited) return limited;
    if (contentLengthTooLarge(request, 150_000)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json();
    const mission = await runResearchMission({
      topic: body.topic,
      researchQuestion: body.researchQuestion,
      objectives: body.objectives,
      field: body.field,
      keywords: body.keywords,
      missionType: body.missionType,
      depth: body.depth,
      fromYear: body.fromYear,
      toYear: body.toYear,
      maxSources: body.maxSources,
    });

    return NextResponse.json(mission, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research mission failed.";
    const status = /at least eight characters/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
