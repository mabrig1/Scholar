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
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { NounGeneratedThesis, NounThesisInput } from "./noun-thesis";

const FONT = "Times New Roman";
const FONT_SIZE = 24;
const DOUBLE_SPACING = 480;
const SINGLE_SPACING = 240;
const FIRST_LINE_INDENT = 720;
const ONE_INCH = 1440;
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;

function run(text: string, options: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: options.size || FONT_SIZE,
    bold: options.bold,
    italics: options.italics,
  });
}

function centered(text: string, options: { bold?: boolean; size?: number; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: options.before || 0, after: options.after || 0, line: DOUBLE_SPACING },
    children: [run(text, { bold: options.bold, size: options.size })],
  });
}

function body(text: string, options: { single?: boolean; noIndent?: boolean; alignment?: typeof AlignmentType.CENTER | typeof AlignmentType.LEFT | typeof AlignmentType.JUSTIFIED } = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    indent: options.noIndent ? undefined : { firstLine: FIRST_LINE_INDENT },
    spacing: { line: options.single ? SINGLE_SPACING : DOUBLE_SPACING, after: 0 },
    children: [run(text)],
  });
}

function pageTitle(text: string) {
  return new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 240, line: DOUBLE_SPACING },
    children: [run(text.toUpperCase(), { bold: true })],
  });
}

function pageNumberFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ font: FONT, size: 20, children: [PageNumber.CURRENT] })],
    })],
  });
}

function blankFooter() {
  return new Footer({ children: [new Paragraph({ children: [] })] });
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cleanMarkdownText(cell.trim()));
}

function isMarkdownTableSeparator(line: string) {
  if (!line.includes("|")) return false;
  const cells = parseMarkdownTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function wordTable(headers: string[], rows: string[][]) {
  const width = Math.max(headers.length, ...rows.map(row => row.length), 1);
  const normalize = (row: string[]) => Array.from({ length: width }, (_, index) => row[index] || "");
  const makeCell = (text: string, bold = false) => new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: SINGLE_SPACING, after: 60 },
      children: [run(text, { bold, size: 22 })],
    })],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: normalize(headers).map(text => makeCell(text, true)) }),
      ...rows.map(row => new TableRow({ children: normalize(row).map(text => makeCell(text)) })),
    ],
  });
}

function markdownParagraphs(text: string) {
  const children: Array<Paragraph | Table> = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let paragraphLines: string[] = [];

  const flush = () => {
    const joined = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (joined) children.push(body(cleanMarkdownText(joined)));
    paragraphLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flush();
      continue;
    }

    const nextLine = lines[index + 1]?.trim() || "";
    if (line.includes("|") && isMarkdownTableSeparator(nextLine)) {
      flush();
      const headers = parseMarkdownTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const rowLine = lines[index].trim();
        if (!rowLine || !rowLine.includes("|")) {
          index -= 1;
          break;
        }
        rows.push(parseMarkdownTableRow(rowLine));
        index += 1;
      }
      children.push(wordTable(headers, rows));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^(\d+[.)])\s+(.+)$/);

    if (heading) {
      flush();
      const level = heading[1].length;
      const textValue = cleanMarkdownText(heading[2]);
      const chapterHeading = /^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)/i.test(textValue);
      children.push(new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        pageBreakBefore: chapterHeading,
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: level === 1 ? 240 : 180, after: 120, line: DOUBLE_SPACING },
        children: [run(level === 1 ? textValue.toUpperCase() : textValue, { bold: true })],
      }));
      continue;
    }

    if (bullet) {
      flush();
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 360 },
        spacing: { line: DOUBLE_SPACING, after: 0 },
        children: [run(`• ${cleanMarkdownText(bullet[1])}`)],
      }));
      continue;
    }

    if (numbered) {
      flush();
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 360 },
        spacing: { line: DOUBLE_SPACING, after: 0 },
        children: [run(`${numbered[1]} ${cleanMarkdownText(numbered[2])}`)],
      }));
      continue;
    }

    paragraphLines.push(line);
  }

  flush();
  return children;
}

function titlePage(input: NounThesisInput) {
  const workType = input.degreeLevel === "undergraduate"
    ? "project"
    : input.degreeLevel === "phd"
      ? "thesis"
      : "dissertation/project";
  const submissionStatement = `A ${workType} submitted to the Department of ${input.department}, Faculty of ${input.faculty}, National Open University of Nigeria, in partial fulfilment of the requirements for the award of ${input.award}.`;

  return [
    centered(input.title.toUpperCase(), { bold: true, size: 28, before: 360, after: 720 }),
    centered("BY", { bold: true, after: 240 }),
    centered(input.studentName.toUpperCase(), { bold: true, after: 120 }),
    centered(input.matricNumber.toUpperCase(), { bold: true, after: 720 }),
    centered(submissionStatement, { after: 480 }),
    ...(input.studyCentre ? [centered(`STUDY CENTRE: ${input.studyCentre.toUpperCase()}`, { bold: true, after: 240 })] : []),
    centered(input.monthYear.toUpperCase(), { bold: true }),
  ];
}

function declarationPage(input: NounThesisInput) {
  return [
    pageTitle("DECLARATION"),
    body(`I, ${input.studentName}, with matriculation number ${input.matricNumber}, declare that this work is the result of my research effort and, to the best of my knowledge, has not been presented by any other person for the award of a degree except where due acknowledgement has been made.`),
    body("______________________________", { noIndent: true, alignment: AlignmentType.LEFT }),
    body("Student's Signature / Date", { noIndent: true, alignment: AlignmentType.LEFT }),
  ];
}

function certificationPage(input: NounThesisInput) {
  return [
    pageTitle("CERTIFICATION"),
    body(`This is to certify that the research work titled “${input.title}” was carried out by ${input.studentName} (${input.matricNumber}) under approved supervision in the Department of ${input.department}, Faculty of ${input.faculty}, National Open University of Nigeria.`),
    body("______________________________", { noIndent: true, alignment: AlignmentType.LEFT }),
    body(`${input.supervisor || "Supervisor"} / Signature / Date`, { noIndent: true, alignment: AlignmentType.LEFT }),
  ];
}

function referenceParagraphs(value: string) {
  const items = value.split(/\n{1,}/).map(item => item.trim()).filter(Boolean);
  if (!items.length) return [body("[Add verified APA references used in the study]", { noIndent: true })];
  return items.map(item => new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 720, hanging: 720 },
    spacing: { line: DOUBLE_SPACING, after: 0 },
    children: [run(item)],
  }));
}

export async function buildNounThesisWordDocument(input: NounThesisInput, generated: NounGeneratedThesis) {
  const fullFrontMatter = input.mode === "full";
  const proposalFrontMatter = input.mode === "proposal";
  const prelimChildren: any[] = [...titlePage(input)];

  if (fullFrontMatter) {
    prelimChildren.push(
      ...declarationPage(input),
      ...certificationPage(input),
      pageTitle("DEDICATION"),
      body(input.dedication || "[Insert dedication if required]", { noIndent: true, alignment: AlignmentType.CENTER }),
      pageTitle("ACKNOWLEDGEMENTS"),
      body(input.acknowledgement || "[Insert acknowledgements approved by the student]"),
      pageTitle("TABLE OF CONTENTS"),
    );

    if (input.automaticTableOfContents) {
      prelimChildren.push(new TableOfContents("", { hyperlink: true, headingStyleRange: "1-3" }));
    } else {
      prelimChildren.push(body("[Update the table of contents in Microsoft Word after final pagination]", { noIndent: true }));
    }

    prelimChildren.push(
      pageTitle("LIST OF TABLES"),
      body("[Update automatically or insert list of tables after finalising the results chapter]", { noIndent: true }),
      pageTitle("LIST OF FIGURES"),
      body("[Update automatically or insert list of figures if applicable]", { noIndent: true }),
      pageTitle("ABSTRACT"),
      body(generated.abstract || "[Insert abstract after the thesis findings are finalised]", { single: true, noIndent: true }),
    );
  } else if (proposalFrontMatter) {
    prelimChildren.push(
      pageTitle("RESEARCH PROPOSAL"),
      body("This document contains Chapters One to Three prepared as a supervised NOUN research proposal draft. Verify all citations, methodology details and faculty requirements before submission."),
    );
  }

  const bodyChildren: any[] = [];
  for (const chapter of generated.chapters) {
    bodyChildren.push(...markdownParagraphs(chapter.text));
  }

  if (input.mode === "full") {
    bodyChildren.push(pageTitle("REFERENCES"), ...referenceParagraphs(input.verifiedSources));
    bodyChildren.push(pageTitle("APPENDICES"));
    bodyChildren.push(...markdownParagraphs(input.appendices || "[Insert letter of introduction, attestation where applicable, questionnaire/interview guide, instruments, raw tables or other approved appendices]"));
  }

  const page = {
    size: { width: A4_WIDTH, height: A4_HEIGHT, orientation: PageOrientation.PORTRAIT },
    margin: { top: ONE_INCH, right: ONE_INCH, bottom: ONE_INCH, left: ONE_INCH, header: 720, footer: 720 },
  };

  const sections: any[] = fullFrontMatter
    ? [
        {
          properties: {
            titlePage: true,
            page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
          },
          footers: { first: blankFooter(), default: pageNumberFooter() },
          children: prelimChildren,
        },
        {
          properties: {
            page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
          },
          footers: { default: pageNumberFooter() },
          children: bodyChildren,
        },
      ]
    : [
        {
          properties: {
            titlePage: true,
            page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
          },
          footers: { first: blankFooter(), default: pageNumberFooter() },
          children: [...prelimChildren, ...bodyChildren],
        },
      ];

  const doc = new Document({ sections });
  return Packer.toBuffer(doc);
}
