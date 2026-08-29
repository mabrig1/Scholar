import { NextResponse } from "next/server";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";
import { buildAcademicWordDocument } from "@/lib/word-document";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const topic = String(body.topic ?? "Chapter Two").trim().slice(0, 220) || "Chapter Two";
    const draft = String(body.draft ?? "").trim();
    const integrityNotice = String(body.integrityNotice ?? "").trim().slice(0, 1_000);
    if (draft.length < 200) return NextResponse.json({ error: "Generate a Chapter Two draft before exporting." }, { status: 400 });
    if (draft.length > 180_000) return NextResponse.json({ error: "The draft is too long for instant Word export." }, { status: 413 });
    const documentText = `${draft}\n\n## Research integrity note\n${integrityNotice || "Verify every claim against the cited full text before submission."}`;
    const buffer = await buildAcademicWordDocument({
      text: documentText,
      title: topic,
      font: "Times New Roman",
      fontSize: 12,
      spacing: "2.0",
      formatPreset: "custom",
      coverPage: false,
      references: true,
      bodyAlignment: "left",
      paragraphIndentation: "first-line",
      boldHeadings: true,
      cleanSpecialCharacters: true,
      pageNumberPosition: "header-right",
      headingPreset: "apa7",
      automaticTableOfContents: true,
      apaFormatting: true,
      referenceStyle: "apa7",
      removeEmptyParagraphs: true,
      widowOrphanControl: true,
    });
    const filename = safeAttachmentFilename(`${topic}-chapter-two`, { extension: ".docx", fallback: "chapter-two-literature-review" });
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": attachmentContentDisposition(filename),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Chapter Two Word export failed", error);
    return NextResponse.json({ error: "Unable to generate the Chapter Two Word document." }, { status: 500 });
  }
}
