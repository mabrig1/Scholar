import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/extract-document-text";
import { REVIEW_LIMIT } from "@/lib/manuscript-review";
import { readReviewBody, ReviewRequestError } from "@/lib/manuscript-review-server";
import { rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, "manuscript-review:extract", 8, 10 * 60_000);
    if (limited) return limited;
    const bytes = await readReviewBody(request, 5_300_000);
    let form;
    try { form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData(); }
    catch { throw new ReviewRequestError("Upload a valid manuscript file."); }
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(pdf|docx|txt|md)$/i.test(file.name)) throw new ReviewRequestError("Choose a PDF, DOCX, TXT or Markdown file.");
    if (file.size > 5_000_000) throw new ReviewRequestError("Upload a file no larger than 5 MB.", 413);
    const extracted = await extractDocumentText(file);
    if (!extracted.text || extracted.text.length < 200) throw new ReviewRequestError("Not enough readable text. Scanned PDFs need OCR first; alternatively paste the manuscript text.", 422);
    if (extracted.text.length > REVIEW_LIMIT) throw new ReviewRequestError("This document exceeds 60,000 characters. Paste a selected section and choose excerpt review; no text was silently truncated.", 413);
    return NextResponse.json({ text: extracted.text, warning: extracted.warning, source: extracted.source }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReviewRequestError ? error.message : "Unable to extract this document. Try a text-based PDF, DOCX or pasted text." }, { status: error instanceof ReviewRequestError ? error.status : 422, headers });
  }
}
