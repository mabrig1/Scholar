import { NextResponse } from "next/server";
import {
  DocumentTransformationError,
  parseDocumentTransformationMode,
  transformAcademicText,
} from "@/lib/ai-document-transform";
import {
  formToggleEnabled,
  parseBodyAlignment,
  parseDocumentLineSpacing,
  parseFormatPreset,
  parseHeadingPreset,
  parsePageNumberPosition,
  parseParagraphIndentation,
  parseReferenceStyle,
} from "@/lib/document-format-options";
import { buildAcademicWordDocument } from "@/lib/word-document";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";

export const runtime = "nodejs";

const MAX_CHARS = 600_000;
const MAX_AI_DRAFT_PAGES = 20;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") || "").trim();
    const title = String(form.get("title") || "Academic Document").trim() || "Academic Document";
    const studentName = String(form.get("studentName") || "").trim();
    const font = String(form.get("font") || "Times New Roman").trim() || "Times New Roman";
    const fontSize = Math.min(30, Math.max(8, Number(form.get("fontSize") || 12)));
    const formatPreset = parseFormatPreset(form.get("formatPreset"));
    const spacing = formatPreset === "unn" ? "2.0" : parseDocumentLineSpacing(form.get("spacing"));
    const targetPages = Math.min(MAX_AI_DRAFT_PAGES, Math.max(1, Number(form.get("targetPages") || 3)));
    const coverPage = form.get("coverPage") === "on";
    const references = form.get("references") === "on";
    const transformationMode = parseDocumentTransformationMode(form.get("transformationMode"));
    const bodyAlignment = parseBodyAlignment(form.get("bodyAlignment"));
    const paragraphIndentation = parseParagraphIndentation(form.get("paragraphIndentation"));
    const boldHeadings = formToggleEnabled(form, "boldHeadings");
    const cleanSpecialCharacters = formToggleEnabled(form, "cleanSpecialCharacters");
    const pageNumberPosition = parsePageNumberPosition(form.get("pageNumberPosition"));
    const headingPreset = parseHeadingPreset(form.get("headingPreset"));
    const headerText = String(form.get("headerText") || "").trim().slice(0, 160);
    const footerText = String(form.get("footerText") || "").trim().slice(0, 160);
    const automaticTableOfContents = formToggleEnabled(form, "automaticTableOfContents", false);
    const apaFormatting = formToggleEnabled(form, "apaFormatting", false);
    const referenceStyle = parseReferenceStyle(form.get("referenceStyle") || (apaFormatting ? "apa7" : "none"));
    const removeEmptyParagraphs = formToggleEnabled(form, "removeEmptyParagraphs");
    const widowOrphanControl = formToggleEnabled(form, "widowOrphanControl");

    if (!text) return NextResponse.json({ error: "Paste text before converting to Word." }, { status: 400 });
    if (text.length > MAX_CHARS) return NextResponse.json({ error: "Text is too long for the instant converter." }, { status: 413 });

    const transformed = await transformAcademicText({
      text: transformationMode === "write-assignment" ? "" : text,
      title,
      mode: transformationMode,
      instructions: transformationMode === "write-assignment" ? text : "",
      targetPages,
      referencesRequested: references,
    });
    const buffer = await buildAcademicWordDocument({
      text: transformed.text,
      title,
      studentName,
      font,
      fontSize,
      spacing,
      formatPreset,
      coverPage,
      references,
      bodyAlignment,
      paragraphIndentation,
      boldHeadings,
      cleanSpecialCharacters,
      pageNumberPosition,
      headingPreset,
      headerText,
      footerText,
      automaticTableOfContents,
      apaFormatting,
      referenceStyle,
      removeEmptyParagraphs,
      widowOrphanControl,
    });

    const filename = safeAttachmentFilename(title || "academic-document", {
      extension: ".docx",
      fallback: "academic-document",
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Text-Transformation": transformationMode,
        "X-Text-Changed": transformed.changed ? "true" : "false",
        "X-AI-Used": transformationMode === "format" ? "false" : "true",
      },
    });
  } catch (error) {
    if (error instanceof DocumentTransformationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Standalone Word conversion failed", error);
    return NextResponse.json({ error: "Unable to generate the Word document." }, { status: 500 });
  }
}
