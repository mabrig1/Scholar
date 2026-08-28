import { NextResponse } from "next/server";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";
import {
  humanizeNounChapter,
  NounChapterHumanizerError,
  parseNounChapterNumber,
  parseNounRewriteDepth,
} from "@/lib/noun-chapter-humanizer";
import { buildNounChapterWordDocument } from "@/lib/noun-chapter-word";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CHARS = 160_000;

function field(form: FormData, name: string, max = MAX_CHARS) {
  return String(form.get(name) || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const chapter = parseNounChapterNumber(form.get("chapter"));
    const depth = parseNounRewriteDepth(form.get("depth"));
    const chapterText = field(form, "chapterText");
    const researchTitle = field(form, "researchTitle", 300);
    const studentName = field(form, "studentName", 160);
    const matricNumber = field(form, "matricNumber", 80);
    const supervisorCorrections = field(form, "supervisorCorrections", 20_000);
    const extraInstructions = field(form, "extraInstructions", 10_000);

    if (!chapterText) {
      return NextResponse.json({ error: "Paste the NOUN thesis chapter before using Rewriter & Humanizer." }, { status: 400 });
    }
    if (chapterText.length > MAX_CHARS) {
      return NextResponse.json({ error: "This chapter is too long for one rewrite. Divide it into sections and process them separately." }, { status: 413 });
    }

    const rewritten = await humanizeNounChapter({
      text: chapterText,
      chapter,
      depth,
      title: researchTitle,
      supervisorCorrections,
      extraInstructions,
    });

    const buffer = await buildNounChapterWordDocument({
      chapter,
      text: rewritten,
      researchTitle,
      studentName,
      matricNumber,
    });

    const filename = safeAttachmentFilename(
      `${studentName || "NOUN"}-Chapter-${chapter}-Rewritten-Humanized`,
      { extension: ".docx", fallback: `NOUN-Chapter-${chapter}-Rewritten-Humanized` },
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-NOUN-Chapter": String(chapter),
        "X-NOUN-Rewrite-Depth": depth,
        "X-AI-Used": "true",
        "X-Evidence-Integrity": "checked",
      },
    });
  } catch (error) {
    if (error instanceof NounChapterHumanizerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("NOUN chapter rewrite failed", error);
    return NextResponse.json({ error: "Unable to rewrite and humanize the NOUN chapter." }, { status: 500 });
  }
}
