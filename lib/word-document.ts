import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  BodyAlignment,
  DocumentLineSpacing,
  FormatPreset,
  HeadingPreset,
  PageNumberPosition,
  ParagraphIndentation,
  ReferenceStyle,
} from "./document-format-options";

export type WordDocumentOptions = {
  text: string;
  title?: string;
  studentName?: string;
  orderNumber?: string;
  font?: string;
  fontSize?: number;
  spacing?: DocumentLineSpacing | string;
  formatPreset?: FormatPreset;
  coverPage?: boolean;
  references?: boolean;
  paragraphIndentation?: ParagraphIndentation;
  bodyAlignment?: BodyAlignment;
  boldHeadings?: boolean;
  cleanSpecialCharacters?: boolean;
  pageNumberPosition?: PageNumberPosition;
  headerText?: string;
  footerText?: string;
  headingPreset?: HeadingPreset;
  automaticTableOfContents?: boolean;
  apaFormatting?: boolean;
  referenceStyle?: ReferenceStyle;
  removeEmptyParagraphs?: boolean;
  widowOrphanControl?: boolean;
};

type DocumentBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "checklist"; text: string; checked: boolean }
  | { kind: "number"; text: string; group: number }
  | { kind: "spacer" };

function lineSpacing(value?: string) {
  if (value === "1.0" || value === "single") return 240;
  if (value === "1.15") return 276;
  if (value === "2.0" || value === "double") return 480;
  return 360;
}

type HeadingToken = {
  size: number;
  bold: boolean;
  italics: boolean;
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType];
  before: number;
  after: number;
};

function headingTokens(preset: HeadingPreset, fontSize: number, boldHeadings: boolean) {
  const normalSize = fontSize * 2;
  if (preset === "apa7") {
    return {
      1: { size: normalSize, bold: true, italics: false, alignment: AlignmentType.CENTER, before: 240, after: 120 },
      2: { size: normalSize, bold: true, italics: false, alignment: AlignmentType.LEFT, before: 240, after: 120 },
      3: { size: normalSize, bold: true, italics: true, alignment: AlignmentType.LEFT, before: 200, after: 80 },
    } satisfies Record<1 | 2 | 3, HeadingToken>;
  }
  if (preset === "compact") {
    return {
      1: { size: Math.max(normalSize + 4, 28), bold: boldHeadings, italics: false, alignment: AlignmentType.LEFT, before: 220, after: 80 },
      2: { size: Math.max(normalSize + 2, 26), bold: boldHeadings, italics: false, alignment: AlignmentType.LEFT, before: 180, after: 70 },
      3: { size: Math.max(normalSize, 24), bold: boldHeadings, italics: true, alignment: AlignmentType.LEFT, before: 160, after: 60 },
    } satisfies Record<1 | 2 | 3, HeadingToken>;
  }
  return {
    1: { size: Math.max(normalSize + 6, 30), bold: boldHeadings, italics: false, alignment: AlignmentType.LEFT, before: 280, after: 100 },
    2: { size: Math.max(normalSize + 4, 28), bold: boldHeadings, italics: false, alignment: AlignmentType.LEFT, before: 240, after: 100 },
    3: { size: Math.max(normalSize + 2, 26), bold: boldHeadings, italics: true, alignment: AlignmentType.LEFT, before: 220, after: 80 },
  } satisfies Record<1 | 2 | 3, HeadingToken>;
}

function cleanText(value: string, cleanSpecialCharacters: boolean) {
  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ");

  if (!cleanSpecialCharacters) return normalized.trim();
  return normalized
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€(?:|�)/g, "”")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/Â/g, "")
    .trim();
}

const PAGE_CONTENT_WIDTH = 9026;
const NO_TABLE_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function pageNumberRun(font: string, apaFormatting: boolean) {
  return new TextRun({
    font,
    size: 18,
    children: apaFormatting ? [PageNumber.CURRENT] : ["Page ", PageNumber.CURRENT],
  });
}

function furnitureCell(children: Paragraph[], width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    children,
  });
}

function makeHeader(options: {
  text: string;
  font: string;
  pageNumberPosition: PageNumberPosition;
  apaFormatting: boolean;
}) {
  if (!options.text && options.pageNumberPosition !== "header-right") return undefined;
  const leftWidth = Math.floor(PAGE_CONTENT_WIDTH * 0.72);
  const rightWidth = PAGE_CONTENT_WIDTH - leftWidth;
  return new Header({
    children: [new Table({
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [leftWidth, rightWidth],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      rows: [new TableRow({ children: [
        furnitureCell([new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 0 },
          children: options.text ? [new TextRun({ text: options.text, font: options.font, size: 18 })] : [],
        })], leftWidth),
        furnitureCell([new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: options.pageNumberPosition === "header-right"
            ? [pageNumberRun(options.font, options.apaFormatting)]
            : [],
        })], rightWidth),
      ] })],
    })],
  });
}

function makeFooter(options: {
  text: string;
  font: string;
  pageNumberPosition: PageNumberPosition;
  apaFormatting: boolean;
}) {
  if (!options.text && !options.pageNumberPosition.startsWith("footer-")) return undefined;
  const leftWidth = 3610;
  const centerWidth = 1806;
  const rightWidth = PAGE_CONTENT_WIDTH - leftWidth - centerWidth;
  const pageRun = pageNumberRun(options.font, options.apaFormatting);
  return new Footer({
    children: [new Table({
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [leftWidth, centerWidth, rightWidth],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      rows: [new TableRow({ children: [
        furnitureCell([new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 0 },
          children: options.text ? [new TextRun({ text: options.text, font: options.font, size: 18 })] : [],
        })], leftWidth),
        furnitureCell([new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
          children: options.pageNumberPosition === "footer-center" ? [pageRun] : [],
        })], centerWidth),
        furnitureCell([new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: options.pageNumberPosition === "footer-right" ? [pageRun] : [],
        })], rightWidth),
      ] })],
    })],
  });
}

function cleanPlainSegment(value: string, cleanSpecialCharacters: boolean) {
  if (!cleanSpecialCharacters) return value;
  return value
    .replace(/(^|[\s([{])#{1,6}\s*/g, "$1")
    .replace(/(^|[\s([{])(?:\*{1,3}|_{2,3}|`{1,3}|~{2})/g, "$1")
    .replace(/(?:\*{1,3}|_{2,3}|`{1,3}|~{2})(?=\s|$|[.,;:!?)}\]])/g, "")
    .replace(/(^|\s)[•●▪◆■►▶★☆✓✔✦✧]+\s*/g, "$1");
}

function stripMarkdownForHeading(value: string) {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .trim();
}

function isHeading(value: string) {
  const line = stripMarkdownForHeading(value);
  if (!line || line.length > 140) return false;

  return (
    /^(chapter\s+([ivxlcdm]+|\d+)|abstract|introduction|background( of the study)?|statement of the problem|objectives? of the study|research questions?|research hypotheses?|significance of the study|scope of the study|literature review|methodology|research methodology|results?|findings?|discussion( of findings)?|summary|conclusion|recommendations?|references|bibliography|works cited|appendix|appendices)$/i.test(line) ||
    /^\d+(\.\d+){0,3}\s+[A-Z][\s\S]{1,120}$/.test(line) ||
    /^[A-Z][A-Z\s&,:()\-]{5,120}$/.test(line)
  );
}

function isReferenceHeading(value: string) {
  return /^(references|bibliography|works cited)$/i.test(stripMarkdownForHeading(value));
}

function isLabeledParagraph(value: string) {
  return /^(?:\*\*|__)(?:keywords?|key insight|core mission|note|important|recommendation)s?\b/i.test(value);
}

function isStandaloneEmphasisHeading(value: string) {
  const match = value.match(/^(?:\*\*|__)(.+?)(?:\*\*|__)$/);
  if (!match) return null;
  const text = match[1].trim();
  return text.length <= 140 && /^(?:phase|part|step)\s+(?:[ivxlcdm]+|\d+)\b/i.test(text) ? text : null;
}

function isStructuralLine(value: string) {
  return (
    /^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?|-{3,}$|\*{3,}$|_{3,}$)/.test(value) ||
    Boolean(isStandaloneEmphasisHeading(value)) ||
    isLabeledParagraph(value) ||
    isHeading(value)
  );
}

function shouldJoinWrappedLine(current: string, next: string) {
  if (!next || isStructuralLine(next)) return false;
  const visibleEnding = current.replace(/(?:\*\*|__|\*|_)+$/, "").trimEnd();
  if (/[.!?]["'’”)}\]]*$/.test(visibleEnding)) return false;
  if (/[,;:—–-]$/.test(visibleEnding)) return true;
  return current.length >= 90 || /^[a-z]/.test(next);
}

function parseDocumentBlocks(value: string, cleanSpecialCharacters: boolean, removeEmptyParagraphs: boolean) {
  const lines = cleanText(value, cleanSpecialCharacters).split("\n");
  const blocks: DocumentBlock[] = [];
  let paragraphLines: string[] = [];
  let activeNumberGroup = 0;
  let nextNumberGroup = 0;
  let lastNumberValue: number | null = null;
  let previousKind = "";

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    paragraphLines = [];
    lastNumberValue = null;
    previousKind = "paragraph";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      if (!removeEmptyParagraphs && blocks.length > 0 && previousKind !== "spacer") {
        blocks.push({ kind: "spacer" });
        previousKind = "spacer";
      } else if (removeEmptyParagraphs) {
        previousKind = "";
      }
      continue;
    }

    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
    const checklist = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      lastNumberValue = null;
      previousKind = "rule";
    } else if (markdownHeading) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({
        kind: "heading",
        text: stripMarkdownForHeading(markdownHeading[2]),
        level: Math.min(3, markdownHeading[1].length),
      });
      previousKind = "heading";
    } else if (checklist) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({
        kind: "checklist",
        text: checklist[2].trim(),
        checked: checklist[1].toLowerCase() === "x",
      });
      previousKind = "checklist";
    } else if (bullet) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({ kind: "bullet", text: bullet[1].trim() });
      previousKind = "bullet";
    } else if (numbered) {
      flushParagraph();
      const numberValue = Number(numbered[1]);
      if (lastNumberValue === null || numberValue !== lastNumberValue + 1) activeNumberGroup = ++nextNumberGroup;
      blocks.push({ kind: "number", text: numbered[2].trim(), group: activeNumberGroup });
      lastNumberValue = numberValue;
      previousKind = "number";
    } else if (quote) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({ kind: "quote", text: quote[1].trim() });
      previousKind = "quote";
    } else if (isStandaloneEmphasisHeading(line)) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({ kind: "heading", text: isStandaloneEmphasisHeading(line)!, level: 3 });
      previousKind = "heading";
    } else if (isHeading(line)) {
      flushParagraph();
      lastNumberValue = null;
      blocks.push({ kind: "heading", text: stripMarkdownForHeading(line), level: 1 });
      previousKind = "heading";
    } else {
      paragraphLines.push(line);
      const nextLine = lines[index + 1]?.trim() || "";
      if (!shouldJoinWrappedLine(line, nextLine)) flushParagraph();
    }
  }

  flushParagraph();
  if (blocks[0]?.kind === "paragraph" && blocks[1]?.kind === "heading" && blocks[0].text.length <= 200) {
    blocks[0] = { kind: "title", text: blocks[0].text };
  }
  return blocks;
}

function normalizeInlineLinks(value: string) {
  return value.replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "$1 ($2)");
}

function inlineRuns(
  value: string,
  font: string,
  size: number,
  cleanSpecialCharacters: boolean,
  base: { bold?: boolean; italics?: boolean; color?: string } = {},
) {
  const text = normalizeInlineLinks(value);
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  const runs: TextRun[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      runs.push(new TextRun({
        text: cleanPlainSegment(text.slice(cursor, index), cleanSpecialCharacters),
        font,
        size,
        ...base,
      }));
    }

    const token = match[0];
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      runs.push(new TextRun({ text: token.slice(2, -2), font, size, ...base, bold: true }));
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      runs.push(new TextRun({ text: token.slice(1, -1), font, size, ...base, italics: true }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), font: "Courier New", size, ...base }));
    }
    cursor = index + token.length;
  }

  if (cursor < text.length) {
    runs.push(new TextRun({ text: cleanPlainSegment(text.slice(cursor), cleanSpecialCharacters), font, size, ...base }));
  }
  return runs.length
    ? runs
    : [new TextRun({ text: cleanPlainSegment(text, cleanSpecialCharacters), font, size, ...base })];
}

function headingLevel(level: number) {
  if (level <= 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function makeBlockParagraph(options: {
  block: DocumentBlock;
  font: string;
  fontSize: number;
  spacing: number;
  referenceMode: boolean;
  pageBreakBefore: boolean;
  paragraphIndentation: ParagraphIndentation;
  bodyAlignment: BodyAlignment;
  cleanSpecialCharacters: boolean;
  headingStyles: Record<1 | 2 | 3, HeadingToken>;
  widowOrphanControl: boolean;
}) {
  const {
    block,
    font,
    fontSize,
    spacing,
    referenceMode,
    pageBreakBefore,
    paragraphIndentation,
    bodyAlignment,
    cleanSpecialCharacters,
    headingStyles,
    widowOrphanControl,
  } = options;
  const normalSize = fontSize * 2;

  if (block.kind === "spacer") {
    return new Paragraph({ spacing: { after: 120 }, children: [] });
  }

  if (block.kind === "title") {
    return new Paragraph({
      style: "AcademicTitle",
      pageBreakBefore,
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 300, line: spacing },
      children: inlineRuns(block.text, font, Math.max(normalSize + 8, 32), cleanSpecialCharacters, { bold: true, color: "000000" }),
    });
  }

  if (block.kind === "heading") {
    const level = block.level <= 1 ? 1 : block.level === 2 ? 2 : 3;
    const token = headingStyles[level];
    return new Paragraph({
      pageBreakBefore,
      heading: headingLevel(block.level),
      keepNext: true,
      keepLines: true,
      widowControl: widowOrphanControl,
      alignment: token.alignment,
      spacing: { before: token.before, after: token.after, line: 240 },
      children: inlineRuns(block.text, font, token.size, cleanSpecialCharacters, {
        bold: token.bold,
        italics: token.italics,
        color: "000000",
      }),
    });
  }

  if (block.kind === "quote") {
    return new Paragraph({
      pageBreakBefore,
      style: "AcademicQuote",
      alignment: AlignmentType.LEFT,
      indent: { left: 540, right: 360 },
      spacing: { before: 80, after: 140, line: spacing },
      keepLines: true,
      widowControl: widowOrphanControl,
      children: inlineRuns(block.text, font, normalSize, cleanSpecialCharacters, { italics: true }),
    });
  }

  if (block.kind === "bullet") {
    return new Paragraph({
      pageBreakBefore,
      style: "AcademicList",
      bullet: { level: 0 },
      alignment: AlignmentType.LEFT,
      spacing: { after: 60, line: spacing },
      keepLines: true,
      widowControl: widowOrphanControl,
      children: inlineRuns(block.text, font, normalSize, cleanSpecialCharacters),
    });
  }

  if (block.kind === "checklist") {
    return new Paragraph({
      pageBreakBefore,
      style: "AcademicList",
      indent: { left: 720, hanging: 360 },
      alignment: AlignmentType.LEFT,
      spacing: { after: 60, line: spacing },
      keepLines: true,
      widowControl: widowOrphanControl,
      children: [
        new TextRun({ text: block.checked ? "☒  " : "☐  ", font: "Arial", size: normalSize }),
        ...inlineRuns(block.text, font, normalSize, cleanSpecialCharacters),
      ],
    });
  }

  if (block.kind === "number") {
    return new Paragraph({
      pageBreakBefore,
      style: "AcademicList",
      numbering: { reference: `academic-numbering-${block.group}`, level: 0 },
      alignment: AlignmentType.LEFT,
      spacing: { after: 80, line: spacing },
      keepLines: true,
      widowControl: widowOrphanControl,
      children: inlineRuns(block.text, font, normalSize, cleanSpecialCharacters),
    });
  }

  return new Paragraph({
    pageBreakBefore,
    style: referenceMode ? "AcademicReference" : "AcademicBody",
    alignment: referenceMode || bodyAlignment === "left"
      ? AlignmentType.LEFT
      : AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: spacing },
    indent: referenceMode
      ? { left: 720, hanging: 720 }
      : paragraphIndentation === "none" || isLabeledParagraph(block.text)
        ? undefined
        : { firstLine: paragraphIndentation === "first-line-wide" ? 1440 : 720 },
    widowControl: widowOrphanControl,
    children: inlineRuns(block.text, font, normalSize, cleanSpecialCharacters),
  });
}

export async function buildAcademicWordDocument(options: WordDocumentOptions) {
  const cleanSpecialCharacters = options.cleanSpecialCharacters !== false;
  const text = cleanText(options.text, cleanSpecialCharacters);
  if (!text) throw new Error("No document text was supplied for Word conversion.");

  const referenceStyle: ReferenceStyle = options.referenceStyle || (options.apaFormatting ? "apa7" : "none");
  const apaFormatting = Boolean(options.apaFormatting || referenceStyle === "apa7");
  const mlaFormatting = referenceStyle === "mla9";
  const standardFormatting = apaFormatting || mlaFormatting;
  const unnFormatting = (options.formatPreset || "unn") === "unn" && !standardFormatting;
  const font = standardFormatting || unnFormatting ? "Times New Roman" : ((options.font || "Times New Roman").trim() || "Times New Roman");
  const fontSize = standardFormatting || unnFormatting ? 12 : Math.min(30, Math.max(8, Number(options.fontSize || 12)));
  const spacing = lineSpacing(standardFormatting ? "double" : options.spacing);
  const paragraphIndentation = standardFormatting || unnFormatting ? "first-line" : (options.paragraphIndentation || "first-line");
  const bodyAlignment = standardFormatting ? "left" : unnFormatting ? "justified" : (options.bodyAlignment || "justified");
  const boldHeadings = standardFormatting || unnFormatting || options.boldHeadings !== false;
  const headingPreset = apaFormatting ? "apa7" : unnFormatting ? "academic" : (options.headingPreset || "academic");
  const pageNumberPosition = standardFormatting ? "header-right" : (options.pageNumberPosition || "footer-center");
  const references = standardFormatting || unnFormatting || Boolean(options.references);
  const automaticTableOfContents = Boolean(options.automaticTableOfContents);
  const removeEmptyParagraphs = options.removeEmptyParagraphs !== false;
  const widowOrphanControl = options.widowOrphanControl !== false;
  const mlaSurname = options.studentName?.trim().split(/\s+/).at(-1) || "";
  const headerText = cleanText(options.headerText || (mlaFormatting ? mlaSurname : ""), cleanSpecialCharacters).slice(0, 160);
  const footerText = cleanText(options.footerText || "", cleanSpecialCharacters).slice(0, 160);
  const resolvedHeadingStyles = headingTokens(headingPreset, fontSize, boldHeadings);
  const blocks = parseDocumentBlocks(text, cleanSpecialCharacters, removeEmptyParagraphs);
  const tocEntries = blocks
    .filter((block): block is Extract<DocumentBlock, { kind: "heading" }> => block.kind === "heading")
    .map(block => ({
      title: block.text,
      level: block.level <= 1 ? 1 : block.level === 2 ? 2 : 3,
    }));
  const numberGroups = Array.from(new Set(
    blocks.filter((block): block is Extract<DocumentBlock, { kind: "number" }> => block.kind === "number").map(block => block.group),
  ));

  const body: (Paragraph | TableOfContents)[] = [];
  let referenceMode = false;

  if (options.coverPage) {
    body.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 360 },
      children: [new TextRun({
        text: (options.title || "ACADEMIC DOCUMENT").toUpperCase(),
        font,
        size: Math.max(fontSize * 2 + 8, 32),
        bold: true,
      })],
    }));
    if (options.studentName) {
      body.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [new TextRun({ text: options.studentName, font, size: fontSize * 2, bold: true })],
      }));
    }
    if (options.orderNumber) {
      body.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Order: ${options.orderNumber}`, font, size: fontSize * 2 })],
      }));
    }
  }

  if (automaticTableOfContents && tocEntries.length > 0) {
    body.push(new Paragraph({
      style: "AcademicTocTitle",
      pageBreakBefore: Boolean(options.coverPage),
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 0, after: 220, line: 240 },
      children: [new TextRun({ text: "Table of Contents", font, size: Math.max(fontSize * 2 + 6, 30), bold: true })],
    }));
    body.push(new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
      useAppliedParagraphOutlineLevel: true,
      preserveNewLineInEntries: true,
      cachedEntries: tocEntries,
      beginDirty: true,
    }));
  }

  blocks.forEach((block, index) => {
    if (block.kind === "heading") referenceMode = isReferenceHeading(block.text);
    const styledBlock: DocumentBlock = referenceMode && block.kind === "heading" && referenceStyle !== "none"
      ? { ...block, text: referenceStyle === "mla9" ? "Works Cited" : "References" }
      : block;
    const outputBlock: DocumentBlock = referenceMode && references && (
      styledBlock.kind === "number" || styledBlock.kind === "bullet" || styledBlock.kind === "checklist"
    )
      ? { kind: "paragraph", text: styledBlock.text }
      : styledBlock;
    body.push(makeBlockParagraph({
      block: outputBlock,
      font,
      fontSize,
      spacing,
      referenceMode: Boolean(referenceMode && references && outputBlock.kind === "paragraph"),
      pageBreakBefore: Boolean((options.coverPage || (automaticTableOfContents && tocEntries.length > 0)) && index === 0),
      paragraphIndentation,
      bodyAlignment,
      cleanSpecialCharacters,
      headingStyles: resolvedHeadingStyles,
      widowOrphanControl,
    }));
  });

  const header = makeHeader({ text: headerText, font, pageNumberPosition, apaFormatting: standardFormatting });
  const footer = makeFooter({ text: footerText, font, pageNumberPosition, apaFormatting: standardFormatting });
  const heading1 = resolvedHeadingStyles[1];
  const heading2 = resolvedHeadingStyles[2];
  const heading3 = resolvedHeadingStyles[3];

  const doc = new Document({
    creator: "Mabrig ICT & Academic Assistance",
    title: options.title || "Academic Document",
    description: options.orderNumber ? `Generated for ${options.orderNumber}` : "Generated academic document",
    compatibility: { doNotExpandShiftReturn: true },
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font, size: fontSize * 2, color: "000000" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: spacing, after: 120 } },
        },
        heading1: {
          run: { font, size: heading1.size, bold: heading1.bold, italics: heading1.italics, color: "000000" },
          paragraph: { alignment: heading1.alignment, spacing: { before: heading1.before, after: heading1.after }, keepNext: true },
        },
        heading2: {
          run: { font, size: heading2.size, bold: heading2.bold, italics: heading2.italics, color: "000000" },
          paragraph: { alignment: heading2.alignment, spacing: { before: heading2.before, after: heading2.after }, keepNext: true },
        },
        heading3: {
          run: { font, size: heading3.size, bold: heading3.bold, italics: heading3.italics, color: "000000" },
          paragraph: { alignment: heading3.alignment, spacing: { before: heading3.before, after: heading3.after }, keepNext: true },
        },
      },
      paragraphStyles: [
        {
          id: "AcademicTitle",
          name: "Academic Title",
          basedOn: "Normal",
          next: "AcademicBody",
          quickFormat: true,
          run: { font, size: Math.max(fontSize * 2 + 8, 32), bold: true, color: "000000" },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 300, line: spacing }, keepNext: true },
        },
        {
          id: "AcademicTocTitle",
          name: "Academic TOC Title",
          basedOn: "Normal",
          next: "TOC1",
          quickFormat: true,
          run: { font, size: Math.max(fontSize * 2 + 6, 30), bold: true, color: "000000" },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 220 }, keepNext: true },
        },
        {
          id: "AcademicBody",
          name: "Academic Body",
          basedOn: "Normal",
          next: "AcademicBody",
          quickFormat: true,
          run: { font, size: fontSize * 2, color: "000000" },
          paragraph: {
            alignment: bodyAlignment === "left" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
            spacing: { after: 120, line: spacing },
          },
        },
        {
          id: "AcademicList",
          name: "Academic List",
          basedOn: "Normal",
          next: "AcademicList",
          quickFormat: true,
          run: { font, size: fontSize * 2, color: "000000" },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 60, line: spacing } },
        },
        {
          id: "AcademicQuote",
          name: "Academic Quote",
          basedOn: "Normal",
          next: "AcademicBody",
          quickFormat: true,
          run: { font, size: fontSize * 2, italics: true, color: "000000" },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 80, after: 140, line: spacing } },
        },
        {
          id: "AcademicReference",
          name: "Academic Reference",
          basedOn: "Normal",
          next: "AcademicReference",
          quickFormat: true,
          run: { font, size: fontSize * 2, color: "000000" },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 80, line: spacing } },
        },
      ],
    },
    numbering: {
      config: numberGroups.map(group => ({
        reference: `academic-numbering-${group}`,
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      })),
    },
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
          pageNumbers: { start: 1 },
        },
      },
      children: body,
    }],
  });

  return Packer.toBuffer(doc);
}
