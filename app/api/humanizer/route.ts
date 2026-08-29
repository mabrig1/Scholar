import { NextResponse } from "next/server";
import {
  humanizeNounChapter,
  NounChapterHumanizerError,
  parseNounChapterNumber,
  parseNounRewriteDepth,
  parseThesisHumanizationGoal,
} from "@/lib/noun-chapter-humanizer";
import { analyzeThesisStyle, auditRewriteIntegrity } from "@/lib/thesis-style-audit";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CHARS = 80_000;

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const text = clean(body.text, MAX_CHARS + 1);
    const chapter = parseNounChapterNumber(body.chapter);
    const depth = parseNounRewriteDepth(body.depth);
    const goal = parseThesisHumanizationGoal(body.goal);
    if (text.length < 120) return NextResponse.json({ error: "Paste at least 120 characters of thesis text before editing." }, { status: 400 });
    if (text.length > MAX_CHARS) return NextResponse.json({ error: "Process a maximum of 80,000 characters at a time. Divide a long chapter by major section." }, { status: 413 });
    const before = analyzeThesisStyle(text);
    const rewritten = await humanizeNounChapter({
      text,
      chapter,
      depth,
      goal,
      title: clean(body.title, 300),
      voiceSample: clean(body.voiceSample, 5_000),
      supervisorCorrections: clean(body.supervisorCorrections, 20_000),
      extraInstructions: clean(body.extraInstructions, 10_000),
    });
    const after = analyzeThesisStyle(rewritten);
    const integrity = auditRewriteIntegrity(text, rewritten);
    if (!integrity.passed) return NextResponse.json({ error: "The edited text failed the final evidence-integrity audit and was rejected." }, { status: 422 });
    return NextResponse.json({
      rewritten,
      before,
      after,
      integrity,
      chapter,
      depth,
      goal,
      generatedAt: new Date().toISOString(),
      integrityNotice: "The editor preserved detected citations, numerical values, headings, quotations and DOI links. Review the result against the source and follow your institution’s AI-use disclosure policy.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NounChapterHumanizerError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Public thesis humanizer failed", error);
    return NextResponse.json({ error: "Unable to edit the thesis text right now." }, { status: 500 });
  }
}
