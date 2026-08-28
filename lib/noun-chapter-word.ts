import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  NumberFormat,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { NounChapterNumber } from "./noun-chapter-humanizer";

const FONT = "Times New Roman";
const FONT_SIZE = 24;
const DOUBLE_SPACING = 480;
const FIRST_LINE_INDENT = 720;
const ONE_INCH = 1440;
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;

function run(text: string, options: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new TextRun({ text, font: FONT, size: options.size || FONT_SIZE, bold: options.bold, italics: options.italics });
}

function cleanMarkdown(value: string) {
  return value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
}

function body(text: string, noIndent = false) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: noIndent ? undefined : { firstLine: FIRST_LINE_INDENT },
    spacing: { line: DOUBLE_SPACING, after: 0 },
    children: [run(text)],
  });
}

function markdownParagraphs(text: string) {
  const children: Paragraph[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let paragraphLines: string[] = [];

  const flush = () => {
    const joined = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (joined) children.push(body(cleanMarkdown(joined)));
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^(\d+[.)])\s+(.+)$/);

    if (heading) {
      flush();
      const level = heading[1].length;
      const value = cleanMarkdown(heading[2]);
      children.push(new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: level === 1 ? 240 : 180, after: 120, line: DOUBLE_SPACING },
        children: [run(level === 1 ? value.toUpperCase() : value, { bold: true })],
      }));
      continue;
    }

    if (bullet || numbered) {
      flush();
      const prefix = bullet ? "•" : numbered![1];
      const content = cleanMarkdown(bullet ? bullet[1] : numbered![2]);
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 360 },
        spacing: { line: DOUBLE_SPACING, after: 0 },
        children: [run(`${prefix} ${content}`)],
      }));
      continue;
    }
    paragraphLines.push(line);
  }
  flush();
  return children;
}

function pageNumberFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ font: FONT, size: 20, children: [PageNumber.CURRENT] })],
    })],
  });
}

export async function buildNounChapterWordDocument(options: {
  chapter: NounChapterNumber;
  text: string;
  researchTitle?: string;
  studentName?: string;
  matricNumber?: string;
}) {
  const children: Paragraph[] = [];
  if (options.researchTitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180, line: DOUBLE_SPACING },
      children: [run(options.researchTitle.toUpperCase(), { bold: true })],
    }));
  }
  if (options.studentName || options.matricNumber) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240, line: DOUBLE_SPACING },
      children: [run([options.studentName, options.matricNumber].filter(Boolean).join(" • "))],
    }));
  }
  children.push(...markdownParagraphs(options.text));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: A4_WIDTH, height: A4_HEIGHT, orientation: PageOrientation.PORTRAIT },
          margin: { top: ONE_INCH, right: ONE_INCH, bottom: ONE_INCH, left: ONE_INCH, header: 720, footer: 720 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      footers: { default: pageNumberFooter() },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
