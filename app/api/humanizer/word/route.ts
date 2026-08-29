import { NextResponse } from "next/server";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";
import { buildAcademicWordDocument } from "@/lib/word-document";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title ?? "Humanized Thesis Chapter").trim().slice(0, 220) || "Humanized Thesis Chapter";
    const text = String(body.text ?? "").trim();
    const studentName = String(body.studentName ?? "").trim().slice(0, 160);
    if (text.length < 120) return NextResponse.json({ error: "Complete an evidence-safe edit before exporting to Word." }, { status: 400 });
    if (text.length > 100_000) return NextResponse.json({ error: "The edited chapter is too long for instant Word export." }, { status: 413 });
    const buffer = await buildAcademicWordDocument({
      text,
      title,
      studentName,
      font: "Times New Roman",
      fontSize: 12,
      spacing: "2.0",
      formatPreset: "custom",
      references: true,
      bodyAlignment: "justified",
      paragraphIndentation: "first-line",
      boldHeadings: true,
      cleanSpecialCharacters: true,
      pageNumberPosition: "footer-center",
      headingPreset: "academic",
      automaticTableOfContents: false,
      apaFormatting: false,
      referenceStyle: "apa7",
      removeEmptyParagraphs: true,
      widowOrphanControl: true,
    });
    const filename = safeAttachmentFilename(`${title}-humanized`, { extension: ".docx", fallback: "humanized-thesis-chapter" });
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": attachmentContentDisposition(filename),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Humanizer Word export failed", error);
    return NextResponse.json({ error: "Unable to generate the edited Word document." }, { status: 500 });
  }
}
