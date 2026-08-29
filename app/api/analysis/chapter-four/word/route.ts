import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";

export const runtime = "nodejs";

type ReportPayload = {
  studyTitle?: unknown;
  analysisTitle?: unknown;
  narrative?: unknown;
  headers?: unknown;
  rows?: unknown;
  metrics?: unknown;
  notes?: unknown;
  alpha?: unknown;
};

const borders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "B8C8C0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "B8C8C0" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "B8C8C0" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "B8C8C0" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DCE7E2" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DCE7E2" },
};

function text(value: unknown, limit: number) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, limit);
}

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => text(item, maxLength));
}

function tableCell(value: string, bold = false) {
  return new TableCell({
    margins: { top: 90, right: 100, bottom: 90, left: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: value || "—", bold, font: "Times New Roman", size: 22 })] })],
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as ReportPayload;
    const studyTitle = text(payload.studyTitle, 180) || "Thesis Study";
    const analysisTitle = text(payload.analysisTitle, 220);
    const narrative = text(payload.narrative, 12_000);
    const headers = stringArray(payload.headers, 30, 120);
    const rows = Array.isArray(payload.rows)
      ? payload.rows.slice(0, 500).map((row) => stringArray(row, 30, 300))
      : [];
    const metrics = Array.isArray(payload.metrics)
      ? payload.metrics.slice(0, 20).map((metric) => {
        const item = metric && typeof metric === "object" ? metric as Record<string, unknown> : {};
        return { label: text(item.label, 100), value: text(item.value, 160) };
      })
      : [];
    const notes = stringArray(payload.notes, 20, 600);
    const alpha = Number(payload.alpha);

    if (!analysisTitle || !narrative || !headers.length || !rows.length) {
      return NextResponse.json({ error: "A complete analysis summary is required for Word export." }, { status: 400 });
    }

    const resultTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((header) => tableCell(header, true)) }),
        ...rows.map((row) => new TableRow({ children: headers.map((_, index) => tableCell(row[index] || "")) })),
      ],
    });

    const document = new Document({
      creator: "Mabrig Researcher Pro",
      title: `${studyTitle} — Chapter Four Analysis`,
      description: "Chapter Four statistical analysis summary generated from researcher-supplied data.",
      styles: {
        default: { document: { run: { font: "Times New Roman", size: 24 }, paragraph: { spacing: { line: 480, after: 160 } } } },
      },
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE, children: [new TextRun({ text: "CHAPTER FOUR", bold: true, font: "Times New Roman", size: 32 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DATA PRESENTATION, ANALYSIS AND INTERPRETATION", bold: true, font: "Times New Roman", size: 28 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: studyTitle, italics: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: analysisTitle, bold: true, font: "Times New Roman" })] }),
          ...(metrics.length ? [
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Statistical summary", bold: true, font: "Times New Roman" })] }),
            ...metrics.map((metric) => new Paragraph({ children: [new TextRun({ text: `${metric.label}: `, bold: true, font: "Times New Roman" }), new TextRun({ text: metric.value, font: "Times New Roman" })] })),
          ] : []),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Results table", bold: true, font: "Times New Roman" })] }),
          resultTable,
          new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260 }, children: [new TextRun({ text: "Interpretation of findings", bold: true, font: "Times New Roman" })] }),
          new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: narrative, font: "Times New Roman" })] }),
          ...(notes.length ? [
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Reporting notes", bold: true, font: "Times New Roman" })] }),
            ...notes.map((note) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: note, font: "Times New Roman" })] })),
          ] : []),
          new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `Method note: statistical decisions used α = ${Number.isFinite(alpha) ? alpha.toFixed(2) : "0.05"}. Calculations were generated from researcher-supplied data. Verify variable coding, assumptions and conclusions against the source dataset and supervisor-approved statistical workflow before examination or publication.`, italics: true, color: "555555", font: "Times New Roman", size: 20 })] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(document);
    const filename = safeAttachmentFilename(`${studyTitle}-chapter-four-analysis`, { extension: ".docx", fallback: "chapter-four-analysis" });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Chapter Four Word export failed", error);
    return NextResponse.json({ error: "Unable to generate the Chapter Four Word report." }, { status: 500 });
  }
}
