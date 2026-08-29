import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/extract-document-text";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a TXT, Markdown, DOCX or text-based PDF file." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "The uploaded file exceeds the 4 MB limit." }, { status: 413 });
    const extracted = await extractDocumentText(file);
    if (!extracted.text) return NextResponse.json({ error: extracted.warning || "The selected document could not be converted to editable text." }, { status: 415 });
    if (extracted.text.length > 80_000) return NextResponse.json({ error: "The extracted document is too long. Upload or paste one major chapter section at a time." }, { status: 413 });
    return NextResponse.json({ text: extracted.text, source: extracted.source, warning: extracted.warning || null, fileName: file.name }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Humanizer document extraction failed", error);
    return NextResponse.json({ error: "Unable to extract text from the uploaded document." }, { status: 500 });
  }
}
