import { NextResponse } from "next/server";
import { validateReviewInput } from "@/lib/manuscript-review";
import { readReviewBody, ReviewRequestError, reviewWithAi } from "@/lib/manuscript-review-server";
import { rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, "manuscript-review:ai", 4, 10 * 60_000);
    if (limited) return limited;
    const raw = new TextDecoder().decode(await readReviewBody(request, 300_000));
    const body = JSON.parse(raw);
    if (body?.consent !== true) throw new ReviewRequestError("Choose to share this manuscript with configured AI providers before running AI review.");
    let input;
    try { input = validateReviewInput(body); } catch (error) { throw new ReviewRequestError((error as Error).message); }
    return NextResponse.json(await reviewWithAi(input), { headers });
  } catch (error) {
    const status = error instanceof ReviewRequestError ? error.status : error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: error instanceof ReviewRequestError ? error.message : status === 400 ? "Invalid request JSON." : "Unable to review this manuscript. Try basic screening or retry later." }, { status, headers });
  }
}
