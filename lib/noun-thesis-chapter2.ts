import type { NounGeneratedThesis, NounThesisInput } from "./noun-thesis";
import { NounThesisError } from "./noun-thesis";
import type { NounExpertSettings } from "./noun-thesis-expert";

const AI_TIMEOUT_MS = 90_000;
const STUDIES_PER_BATCH = 4;
const MAX_PARALLEL_BATCHES = 2;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export type NounChapterTwoGenerated = NounGeneratedThesis & {
  qualityAudit?: string;
  defensePack?: string;
};

function endpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:markdown|text)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] || trimmed).trim();
}

function stripChapterTwoWrapper(value: string) {
  return value
    .replace(/^#\s*CHAPTER\s+TWO\s*$/gim, "")
    .replace(/^#\s*REVIEW OF RELATED LITERATURE\s*$/gim, "")
    .trim();
}

function splitSourceBlocks(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const paragraphBlocks = normalized.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  if (paragraphBlocks.length > 1) return paragraphBlocks;

  const lines = normalized.split("\n").map(item => item.trim()).filter(Boolean);
  const blocks: string[] = [];
  for (const line of lines) {
    if (/^(?:https?:\/\/|doi\s*[:/]|10\.\d{4,9}\/)/i.test(line) && blocks.length) {
      blocks[blocks.length - 1] = `${blocks[blocks.length - 1]} ${line}`;
    } else {
      blocks.push(line);
    }
  }
  return blocks;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function focusKind(value: string) {
  const focus = value.toLowerCase();
  if (/2\.3|empirical|previous stud|review of previous/.test(focus)) return "empirical" as const;
  if (/2\.2|theoretical|theory/.test(focus)) return "theory" as const;
  if (/2\.1|conceptual/.test(focus)) return "conceptual" as const;
  if (/2\.4|appraisal|research gap|literature gap|summary/.test(focus)) return "gap" as const;
  return "all" as const;
}

function baseContext(input: NounThesisInput, settings: NounExpertSettings, includeSources = true) {
  return [
    "Institution: National Open University of Nigeria (NOUN)",
    `Degree level: ${input.degreeLevel}`,
    `Faculty: ${input.faculty}`,
    `Department: ${input.department}`,
    `Programme: ${input.programme}`,
    `Research title: ${input.title}`,
    input.problemStatement ? `Approved problem statement / research gap:\n${input.problemStatement}` : "",
    input.objectives ? `Approved objectives:\n${input.objectives}` : "",
    input.researchQuestions ? `Approved research questions/hypotheses:\n${input.researchQuestions}` : "",
    includeSources && input.verifiedSources ? `VERIFIED source/reference pack:\n${input.verifiedSources}` : "",
    settings.existingWork ? `Existing Chapter Two / literature-review draft:\n${settings.existingWork}` : "",
    settings.supervisorCorrections ? `Mandatory supervisor corrections:\n${settings.supervisorCorrections}` : "",
    input.facultyInstructions ? `Faculty/supervisor instructions:\n${input.facultyInstructions}` : "",
  ].filter(Boolean).join("\n\n");
}

async function callAi(options: {
  input: NounThesisInput;
  settings: NounExpertSettings;
  label: string;
  instructions: string;
  targetPages: number;
  apiKey: string;
  baseUrl: string;
  model: string;
  contextOverride?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const targetWords = Math.max(650, Math.min(7_000, Math.round(options.targetPages * 350)));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro - NOUN Chapter Two Writer";
  }

  const paragraphRule = options.settings.paragraphTarget === "13-15-lines"
    ? "Use substantial academic paragraphs of roughly 180–250 words where appropriate, without padding."
    : "Use well-developed academic paragraphs with natural variation in length.";
  const citationRule = options.settings.citationDensity === "intensive"
    ? "In literature-heavy synthesis paragraphs, aim for 3–5 APA author-year citations only when those exact sources are present in the verified source material."
    : "Cite evidence where academically necessary, using only supplied verified sources.";

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.15,
        max_tokens: Math.min(12_000, Math.max(1_800, Math.ceil(targetWords * 1.8))),
        messages: [
          {
            role: "system",
            content: [
              "You are the staged Expert NOUN Chapter Two Writer in a protected academic administration system.",
              "Write formal scholarly English and preserve the student's approved research focus.",
              "Never fabricate an article, author, year, journal, DOI, sample, method, instrument, statistic, result, finding, quotation or theory detail.",
              "Use only source information explicitly supplied in the current prompt. If a bibliographic citation does not contain enough information to state a study's method or findings, write [Add verified method/findings for this study] rather than guessing.",
              "Every in-text citation must correspond to a supplied source. Do not use model-memory citations as substitutes for the verified pack.",
              `Prefer sources within the configured ${options.settings.referenceYearStart}-${options.settings.referenceYearEnd} window where the supplied pack supports that choice, while retaining older original theory sources where academically necessary.`,
              paragraphRule,
              citationRule,
              "Use Markdown headings (#, ##, ###). Do not use code fences or decorative formatting.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              options.contextOverride || baseContext(options.input, options.settings),
              `Requested output: ${options.label}`,
              `Approximate target: ${targetWords} words.`,
              options.instructions,
            ].join("\n\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) throw new NounThesisError(payload?.error?.message || `AI provider failed while generating ${options.label}.`, 502);
    const text = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!text) throw new NounThesisError(`The AI writer returned an empty ${options.label}.`, 502);
    return text;
  } catch (error) {
    if (error instanceof NounThesisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NounThesisError(`${options.label} timed out. The staged writer will work best with one reference or study per line/block.`, 504);
    }
    console.error("NOUN Chapter Two generation failed", error);
    throw new NounThesisError(`Unable to generate ${options.label} right now.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function generateEmpiricalReview(options: {
  input: NounThesisInput;
  settings: NounExpertSettings;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const sourceBlocks = splitSourceBlocks(options.input.verifiedSources);
  const target = options.settings.empiricalStudyTarget;
  const selected = sourceBlocks.slice(0, target);

  if (!selected.length) {
    return {
      text: [
        "## 2.3 Empirical Review / Review of Previous Studies",
        "",
        "[Add verified empirical studies with author/year, purpose, methodology/sample and findings. No verified empirical source material was supplied, so the writer will not invent previous studies.]",
      ].join("\n"),
      sourceCount: 0,
      reviewedCount: 0,
    };
  }

  const batches = chunk(selected.map((source, index) => ({ source, studyNumber: index + 1 })), STUDIES_PER_BATCH);
  const outputs = new Array<string>(batches.length);

  for (let start = 0; start < batches.length; start += MAX_PARALLEL_BATCHES) {
    const current = batches.slice(start, start + MAX_PARALLEL_BATCHES);
    const generated = await Promise.all(current.map((batch, batchOffset) => {
      const exactSources = batch.map(item => `STUDY ${item.studyNumber} SOURCE BLOCK:\n${item.source}`).join("\n\n");
      const context = [
        baseContext(options.input, options.settings, false),
        "The following source blocks are the ONLY sources allowed for this batch:",
        exactSources,
      ].join("\n\n");
      return callAi({
        ...options,
        label: `Empirical Review Batch ${start + batchOffset + 1}`,
        targetPages: Math.max(2, Math.ceil(batch.length * 0.8)),
        contextOverride: context,
        instructions: [
          "Write ONLY the empirical-study reviews for the numbered source blocks in this batch. Do not review any source outside this batch.",
          "Preserve the supplied study numbering using headings such as ### Study 1, ### Study 2, and so on.",
          "For EACH supplied study, develop a coherent review covering: author/year and study focus; purpose/objective; design/methodology; population/sample and instrument where supplied; analysis method where supplied; major findings where supplied; relevance to the current study; and the gap/limitation that remains.",
          "Aim for roughly 180–300 words per study when enough verified detail exists.",
          "A reference title or citation alone is NOT enough evidence for method/sample/findings. In that case retain the identifiable bibliographic scope and insert [Add verified method/findings for this study] for unsupported details.",
          "Do not merge multiple source blocks into one study and do not skip a numbered source block.",
        ].join("\n"),
      });
    }));
    generated.forEach((text, offset) => { outputs[start + offset] = text; });
  }

  const missing = Math.max(0, target - selected.length);
  const placeholders = missing
    ? [
        "",
        "### Additional Verified Studies Required",
        `The configured empirical-review target is ${target} studies, but only ${selected.length} source block(s) were supplied. Add ${missing} additional verified empirical source(s), preferably with abstract/method/findings notes, to complete the target without fabrication.`,
      ].join("\n")
    : "";

  return {
    text: [
      "## 2.3 Empirical Review / Review of Previous Studies",
      ...outputs.map(stripChapterTwoWrapper),
      placeholders,
    ].filter(Boolean).join("\n\n"),
    sourceCount: sourceBlocks.length,
    reviewedCount: selected.length,
  };
}

export async function generateExpertNounChapterTwo(input: NounThesisInput, settings: NounExpertSettings): Promise<NounChapterTwoGenerated> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new NounThesisError("NOUN Expert Thesis Writer requires AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel.", 503);
  }

  const focus = focusKind(settings.sectionFocus);
  const totalPages = Math.max(8, Math.min(50, input.targetPages));
  const conceptualPages = Math.max(3, Math.round(totalPages * 0.30));
  const theoryPages = Math.max(3, Math.round(totalPages * 0.22));

  const conceptualJob = focus === "all" || focus === "conceptual"
    ? callAi({
        input,
        settings,
        label: "Chapter Two Part A — Introduction and Conceptual Framework",
        targetPages: conceptualPages,
        apiKey,
        baseUrl,
        model,
        instructions: [
          focus === "conceptual" ? "Focus on ## 2.1 Conceptual Framework." : "Write ## 2.0 Introduction and ## 2.1 Conceptual Framework.",
          "Organise the conceptual framework into approximately eight meaningful thematic subheadings where the topic supports them. Do not use 'Concept of' as a heading.",
          "Define, compare and synthesize constructs using only verified supplied sources. Link the concepts directly to the approved objectives and research problem.",
        ].join("\n"),
      })
    : Promise.resolve("");

  const theoryJob = focus === "all" || focus === "theory"
    ? callAi({
        input,
        settings,
        label: "Chapter Two Part B — Theoretical Framework",
        targetPages: theoryPages,
        apiKey,
        baseUrl,
        model,
        instructions: [
          "Write ONLY ## 2.2 Theoretical Framework.",
          `Use exactly ${settings.theoryCount} theories when the verified source pack supports them. For each: identify the theory/proponent/year only from supplied evidence; explain major tenets; state supported criticisms/limitations; and apply the theory directly to this study.`,
          "If an original proponent/source is not verified in the source pack, insert [Add verified original-proponent citation] rather than inventing one.",
        ].join("\n"),
      })
    : Promise.resolve("");

  const empiricalJob = focus === "all" || focus === "empirical"
    ? generateEmpiricalReview({ input, settings, apiKey, baseUrl, model })
    : Promise.resolve({ text: "", sourceCount: splitSourceBlocks(input.verifiedSources).length, reviewedCount: 0 });

  const [conceptual, theory, empirical] = await Promise.all([conceptualJob, theoryJob, empiricalJob]);

  let gap = "";
  if (focus === "all" || focus === "gap" || focus === "empirical") {
    const generatedReview = [conceptual, theory, empirical.text].filter(Boolean).join("\n\n").slice(0, 55_000);
    gap = await callAi({
      input,
      settings,
      label: "Chapter Two Part D — Appraisal and Research Gap",
      targetPages: Math.max(2, Math.round(totalPages * 0.10)),
      apiKey,
      baseUrl,
      model,
      contextOverride: [
        baseContext(input, settings, false),
        `Generated verified literature-review material:\n${generatedReview}`,
      ].join("\n\n"),
      instructions: [
        "Write ONLY ## 2.4 Summary/Appraisal of Reviewed Literature and Research Gap.",
        "Synthesize what the reviewed literature establishes, where studies agree or differ, the methodological/contextual/theoretical gaps that are actually supported, and how the current study addresses the identified gap.",
        "Do not introduce a new study or citation that is absent from the supplied/generated verified material.",
      ].join("\n"),
    });
  }

  const chapterText = [
    "# CHAPTER TWO\n\n# REVIEW OF RELATED LITERATURE",
    stripChapterTwoWrapper(conceptual),
    stripChapterTwoWrapper(theory),
    stripChapterTwoWrapper(empirical.text),
    stripChapterTwoWrapper(gap),
  ].filter(Boolean).join("\n\n");

  const missingTarget = Math.max(0, settings.empiricalStudyTarget - empirical.reviewedCount);
  const qualityAudit = settings.includeQualityAudit
    ? [
        "# CHAPTER TWO QUALITY AUDIT",
        "",
        `- Source blocks detected in verified source pack: ${empirical.sourceCount}`,
        `- Empirical studies processed in non-overlapping batches: ${empirical.reviewedCount}`,
        `- Configured empirical-study target: ${settings.empiricalStudyTarget}`,
        `- Additional verified study sources/details still required: ${missingTarget}`,
        `- Batch size: ${STUDIES_PER_BATCH} studies per AI request to prevent truncation after early studies.`,
        "- A bibliographic reference without abstract/method/findings detail is not treated as permission to invent study methodology or findings.",
        "- Verify every empirical review against the original article before submission.",
      ].join("\n")
    : undefined;

  return {
    chapters: [{ chapter: 2, title: "REVIEW OF RELATED LITERATURE", text: chapterText }],
    abstract: "",
    qualityAudit,
  };
}
