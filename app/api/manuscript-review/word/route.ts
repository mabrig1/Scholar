import { NextResponse } from "next/server";
import { buildAcademicWordDocument } from "@/lib/word-document";
import { readReviewBody, ReviewRequestError } from "@/lib/manuscript-review-server";
import { rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, "manuscript-review:word", 12, 10 * 60_000);
    if (limited) return limited;
    const body = JSON.parse(new TextDecoder().decode(await readReviewBody(request, 500_000)));
    if (typeof body?.text !== "string" || body.text.length < 100 || body.text.length > 120_000) throw new ReviewRequestError("Provide a review report of 100–120,000 characters.");
    const buffer = await buildAcademicWordDocument({ text: body.text, title: "MABRIG Scholar Manuscript Review", font: "Times New Roman", fontSize: 12, spacing: "1.5", coverPage: false, bodyAlignment: "left" });
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="Scholar-Manuscript-Review.docx"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReviewRequestError ? error.message : "Unable to export this report." }, { status: error instanceof ReviewRequestError ? error.status : error instanceof SyntaxError ? 400 : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
