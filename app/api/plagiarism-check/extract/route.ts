import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/extract-document-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 150_000;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a TXT, Markdown, DOCX or text-based PDF document." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "The uploaded document exceeds the 4 MB limit." }, { status: 413 });
    const extracted = await extractDocumentText(file);
    if (!extracted.text) return NextResponse.json({ error: extracted.warning || "Unable to extract readable text from this document." }, { status: 415 });
    if (extracted.text.length > MAX_CHARS) return NextResponse.json({ error: "The extracted document exceeds the 150,000-character scan limit. Check it by chapter or major section." }, { status: 413 });
    return NextResponse.json({ text: extracted.text, fileName: file.name, source: extracted.source, warning: extracted.warning || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Plagiarism document extraction failed", error);
    return NextResponse.json({ error: "Unable to process the uploaded document." }, { status: 500 });
  }
}
