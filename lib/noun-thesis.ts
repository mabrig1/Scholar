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
  TableOfContents,
  TextRun,
} from "docx";

const AI_TIMEOUT_MS = 90_000;
const FONT = "Times New Roman";
const FONT_SIZE = 24;
const DOUBLE_SPACING = 480;
const SINGLE_SPACING = 240;
const FIRST_LINE_INDENT = 720;
const ONE_INCH = 1440;
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;

export type NounDegreeLevel = "undergraduate" | "pgde" | "masters" | "phd";
export type NounWriterMode = "full" | "proposal" | "chapter1" | "chapter2" | "chapter3" | "chapter4" | "chapter5";

export type NounThesisInput = {
  mode: NounWriterMode;
  degreeLevel: NounDegreeLevel;
  targetPages: number;
  title: string;
  studentName: string;
  matricNumber: string;
  faculty: string;
  department: string;
  programme: string;
  award: string;
  studyCentre: string;
  supervisor: string;
  monthYear: string;
  backgroundBrief: string;
  problemStatement: string;
  objectives: string;
  researchQuestions: string;
  methodology: string;
  findingsData: string;
  verifiedSources: string;
  dedication: string;
  acknowledgement: string;
  appendices: string;
  facultyInstructions: string;
  automaticTableOfContents: boolean;
};

export type NounGeneratedThesis = {
  chapters: Array<{ chapter: number; title: string; text: string }>;
  abstract: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export class NounThesisError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "NounThesisError";
  }
}

export function parseNounWriterMode(value: unknown): NounWriterMode {
  const normalized = String(value || "").trim().toLowerCase();
  if (["proposal", "chapter1", "chapter2", "chapter3", "chapter4", "chapter5"].includes(normalized)) {
    return normalized as NounWriterMode;
  }
  return "full";
}

export function parseNounDegreeLevel(value: unknown): NounDegreeLevel {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pgde" || normalized === "masters" || normalized === "phd") return normalized;
  return "undergraduate";
}

export function titleWordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function endpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:markdown|text)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] || trimmed).trim();
}

function chapterTitle(chapter: number) {
  if (chapter === 1) return "INTRODUCTION";
  if (chapter === 2) return "REVIEW OF RELATED LITERATURE";
  if (chapter === 3) return "METHODOLOGY";
  if (chapter === 4) return "RESULTS AND FINDINGS";
  return "DISCUSSION, CONCLUSION AND RECOMMENDATIONS";
}

function chapterStructure(chapter: number, level: NounDegreeLevel) {
  if (chapter === 1) {
    return [
      "1.1 Background to the Study",
      "1.2 Statement of the Problem",
      "1.3 Purpose/Aim and Objectives of the Study",
      "1.4 Research Questions and/or Hypotheses",
      "1.5 Significance of the Study",
      "1.6 Scope of the Study",
      "1.7 Operational Definition of Terms",
    ];
  }
  if (chapter === 2) {
    return [
      "2.1 Conceptual Framework",
      "2.2 Theoretical Framework",
      "2.3 Empirical Review organised under relevant sub-headings",
      "2.4 Appraisal/Summary of Reviewed Literature and Research Gap",
    ];
  }
  if (chapter === 3) {
    return [
      "3.1 Research Design",
      "3.2 Area/Context of the Study where applicable",
      "3.3 Population of the Study",
      "3.4 Sample and Sampling Techniques",
      "3.5 Instrument(s) for Data Collection",
      "3.6 Validity of the Instrument",
      "3.7 Reliability of the Instrument",
      "3.8 Procedure for Data Collection",
      "3.9 Method of Data Analysis",
      "3.10 Ethical Considerations where applicable",
    ];
  }
  if (chapter === 4) {
    return [
      "4.1 Introduction",
      "4.2 Presentation and Analysis of Data / Answers to Research Questions",
      "4.3 Testing of Hypotheses where applicable",
      "4.4 Summary of Findings",
    ];
  }
  const items = [
    "5.1 Discussion of Findings",
    "5.2 Implications of the Study",
    "5.3 Summary",
    "5.4 Conclusion",
    "5.5 Recommendations",
  ];
  if (level === "masters" || level === "phd") items.push("5.6 Contribution to Knowledge");
  items.push(level === "masters" || level === "phd" ? "5.7 Suggestions for Further Studies" : "5.6 Suggestions for Further Studies");
  return items;
}

function selectedChapters(mode: NounWriterMode) {
  if (mode === "proposal") return [1, 2, 3];
  const match = mode.match(/^chapter([1-5])$/);
  if (match) return [Number(match[1])];
  return [1, 2, 3, 4, 5];
}

function chapterPageTarget(input: NounThesisInput, chapter: number) {
  const chapters = selectedChapters(input.mode);
  if (chapters.length === 1) return Math.max(4, Math.min(30, input.targetPages));
  const weights: Record<number, number> = input.mode === "proposal"
    ? { 1: 0.32, 2: 0.43, 3: 0.25 }
    : { 1: 0.18, 2: 0.32, 3: 0.18, 4: 0.15, 5: 0.17 };
  return Math.max(3, Math.round(input.targetPages * (weights[chapter] || (1 / chapters.length))));
}

function researchContext(input: NounThesisInput) {
  return [
    `Institution: National Open University of Nigeria (NOUN)`,
    `Degree level: ${input.degreeLevel}`,
    `Faculty: ${input.faculty}`,
    `Department: ${input.department}`,
    `Programme: ${input.programme}`,
    `Research title: ${input.title}`,
    input.backgroundBrief ? `Background/brief supplied by admin:\n${input.backgroundBrief}` : "",
    input.problemStatement ? `Problem statement supplied by admin:\n${input.problemStatement}` : "",
    input.objectives ? `Objectives supplied by admin:\n${input.objectives}` : "",
    input.researchQuestions ? `Research questions/hypotheses supplied by admin:\n${input.researchQuestions}` : "",
    input.methodology ? `Methodology supplied by admin:\n${input.methodology}` : "",
    input.findingsData ? `Verified findings/data supplied by admin:\n${input.findingsData}` : "",
    input.verifiedSources ? `Verified sources/references supplied by admin:\n${input.verifiedSources}` : "No verified sources were supplied.",
    input.facultyInstructions ? `Faculty/supervisor-specific instructions:\n${input.facultyInstructions}` : "",
  ].filter(Boolean).join("\n\n");
}

async function generatePart(options: {
  input: NounThesisInput;
  label: string;
  instructions: string;
  targetPages: number;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const targetWords = Math.max(900, Math.min(10_000, Math.round(options.targetPages * 350)));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro - NOUN Thesis Writer";
  }

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.25,
        max_tokens: Math.min(12_000, Math.max(2_000, Math.ceil(targetWords * 1.7))),
        messages: [
          {
            role: "system",
            content: [
              "You are a careful Nigerian university research-writing assistant helping an administrator prepare a supervised academic draft for National Open University of Nigeria (NOUN).",
              "Follow the requested NOUN five-chapter structure and use formal scholarly English.",
              "Never fabricate sources, citations, quotations, statistics, respondents, sample results, fieldwork, significance tests, findings, ethics approvals, dates or institutional facts.",
              "Use only verified sources and data supplied in the prompt. Where a claim needs evidence but no verified source is supplied, insert [Add verified citation].",
              "Where results or findings were not supplied, create a clearly labelled results framework with [Insert verified result/data] placeholders; do not invent numbers or findings.",
              "Preserve any citations, reference details, data and facts exactly as supplied.",
              "Use Markdown headings only (#, ##, ###) so the Word renderer can build the thesis hierarchy. Do not use code fences.",
              "Return only the requested academic text, with no explanation to the administrator.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              researchContext(options.input),
              `Requested part: ${options.label}`,
              `Approximate target length: ${targetWords} words (${options.targetPages} pages at roughly 350 words/page).`,
              options.instructions,
            ].join("\n\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) {
      throw new NounThesisError(payload?.error?.message || `AI provider failed while generating ${options.label}.`, 502);
    }
    const text = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!text) throw new NounThesisError(`The AI writer returned an empty ${options.label}.`, 502);
    return text;
  } catch (error) {
    if (error instanceof NounThesisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NounThesisError(`${options.label} generation timed out. Try a smaller page target or generate one chapter at a time.`, 504);
    }
    console.error("NOUN thesis generation failed", error);
    throw new NounThesisError(`Unable to generate ${options.label} right now.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateNounThesis(input: NounThesisInput): Promise<NounGeneratedThesis> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new NounThesisError("NOUN Thesis Writer requires AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel.", 503);
  }

  const chapters = selectedChapters(input.mode);
  const chapterJobs = chapters.map(chapter => generatePart({
    input,
    label: `Chapter ${chapter}: ${chapterTitle(chapter)}`,
    targetPages: chapterPageTarget(input, chapter),
    apiKey,
    baseUrl,
    model,
    instructions: [
      `Write # CHAPTER ${["ONE", "TWO", "THREE", "FOUR", "FIVE"][chapter - 1]} followed by # ${chapterTitle(chapter)}.`,
      "Use these NOUN-aligned sub-headings in order:",
      ...chapterStructure(chapter, input.degreeLevel).map(item => `- ${item}`),
      chapter === 2 ? "For empirical studies, report author/year, purpose, method/sample where supplied, and findings only when supported by a verified source. Do not invent study details." : "",
      chapter === 4 && !input.findingsData ? "No verified findings/data were supplied. Build the chapter structure and analysis tables/placeholders only; explicitly mark every missing result with [Insert verified result/data]." : "",
      chapter === 5 && !input.findingsData ? "No verified findings/data were supplied. Do not claim findings. Build a discussion/conclusion framework tied to the objectives and mark evidence-dependent statements with [Insert verified finding]." : "",
    ].filter(Boolean).join("\n"),
  }));

  const abstractJob = input.mode === "full"
    ? generatePart({
        input,
        label: "Abstract",
        targetPages: 1,
        apiKey,
        baseUrl,
        model,
        instructions: "Write one block paragraph of no more than 400 words covering background/problem, purpose, methods, verified major findings if supplied, conclusion and recommendations. If findings are not supplied, use [Insert verified major findings] rather than inventing them. Do not include citations in the abstract.",
      })
    : Promise.resolve("");

  const [chapterTexts, abstract] = await Promise.all([Promise.all(chapterJobs), abstractJob]);
  return {
    chapters: chapters.map((chapter, index) => ({ chapter, title: chapterTitle(chapter), text: chapterTexts[index] })),
    abstract,
  };
}

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

function markdownParagraphs(text: string) {
  const children: Paragraph[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let paragraphLines: string[] = [];

  const flush = () => {
    const joined = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (joined) children.push(body(cleanMarkdownText(joined)));
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
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
  const submissionStatement = `A ${input.degreeLevel === "undergraduate" ? "project" : input.degreeLevel === "phd" ? "thesis" : "dissertation/project"} submitted to the Department of ${input.department}, Faculty of ${input.faculty}, National Open University of Nigeria, in partial fulfilment of the requirements for the award of ${input.award}.`;
  return [
    centered(input.title.toUpperCase(), { bold: true, size: 28, before: 360, after: 720 }),
    centered("BY", { bold: true, after: 240 }),
    centered(input.studentName.toUpperCase(), { bold: true, after: 120 }),
    centered(input.matricNumber.toUpperCase(), { bold: true, after: 720 }),
    centered(submissionStatement, { after: 480 }),
    input.studyCentre ? centered(`STUDY CENTRE: ${input.studyCentre.toUpperCase()}`, { bold: true, after: 240 }) : centered(""),
    centered(input.monthYear.toUpperCase(), { bold: true }),
  ];
}

function declarationPage(input: NounThesisInput) {
  return [
    pageTitle("DECLARATION"),
    body(`I, ${input.studentName}, with matriculation number ${input.matricNumber}, declare that this work is the result of my research effort and, to the best of my knowledge, has not been presented by any other person for the award of a degree except where due acknowledgement has been made.`),
    body("\n\n______________________________", { noIndent: true, alignment: AlignmentType.LEFT }),
    body("Student's Signature / Date", { noIndent: true, alignment: AlignmentType.LEFT }),
  ];
}

function certificationPage(input: NounThesisInput) {
  return [
    pageTitle("CERTIFICATION"),
    body(`This is to certify that the research work titled “${input.title}” was carried out by ${input.studentName} (${input.matricNumber}) under approved supervision in the Department of ${input.department}, Faculty of ${input.faculty}, National Open University of Nigeria.`),
    body("\n\n______________________________", { noIndent: true, alignment: AlignmentType.LEFT }),
    body(`${input.supervisor || "Supervisor"} / Signature / Date`, { noIndent: true, alignment: AlignmentType.LEFT }),
  ];
}

function appendReferenceParagraphs(value: string) {
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
  const prelimChildren: Paragraph[] = [
    ...titlePage(input),
  ];

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
      prelimChildren.push(new TableOfContents("", { hyperlink: true, headingStyleRange: "1-3" }) as unknown as Paragraph);
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

  const bodyChildren: Paragraph[] = [];
  for (const chapter of generated.chapters) {
    bodyChildren.push(...markdownParagraphs(chapter.text));
  }
  if (input.mode === "full") {
    bodyChildren.push(pageTitle("REFERENCES"), ...appendReferenceParagraphs(input.verifiedSources));
    bodyChildren.push(pageTitle("APPENDICES"));
    bodyChildren.push(...markdownParagraphs(input.appendices || "[Insert letter of introduction, attestation where applicable, questionnaire/interview guide, instruments, raw tables or other approved appendices]"));
  }

  const page = {
    size: { width: A4_WIDTH, height: A4_HEIGHT, orientation: PageOrientation.PORTRAIT },
    margin: { top: ONE_INCH, right: ONE_INCH, bottom: ONE_INCH, left: ONE_INCH, header: 720, footer: 720 },
  };

  const sections = fullFrontMatter
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
