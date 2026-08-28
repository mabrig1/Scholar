export type NounChapterNumber = 1 | 2 | 3 | 4 | 5;
export type NounRewriteDepth = "light" | "balanced" | "deep";

const AI_TIMEOUT_MS = 90_000;
const MAX_CHUNK_CHARS = 12_000;
const MAX_CONCURRENT_REQUESTS = 3;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export class NounChapterHumanizerError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "NounChapterHumanizerError";
  }
}

export function parseNounChapterNumber(value: unknown): NounChapterNumber {
  const parsed = Number(value);
  if ([2, 3, 4, 5].includes(parsed)) return parsed as NounChapterNumber;
  return 1;
}

export function parseNounRewriteDepth(value: unknown): NounRewriteDepth {
  if (value === "light" || value === "deep") return value;
  return "balanced";
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

function splitLongParagraph(value: string) {
  const pieces: string[] = [];
  let remaining = value.trim();
  while (remaining.length > MAX_CHUNK_CHARS) {
    const preferredBreak = Math.max(
      remaining.lastIndexOf(". ", MAX_CHUNK_CHARS),
      remaining.lastIndexOf("; ", MAX_CHUNK_CHARS),
      remaining.lastIndexOf(" ", MAX_CHUNK_CHARS),
    );
    const breakAt = preferredBreak > MAX_CHUNK_CHARS / 2 ? preferredBreak + 1 : MAX_CHUNK_CHARS;
    pieces.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function chunkDocument(text: string) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .flatMap(splitLongParagraph)
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function citationFragments(text: string) {
  const matches = text.match(/\([^\n()]{0,140}\b(?:19|20)\d{2}[a-z]?[^\n()]{0,80}\)/g) || [];
  return Array.from(new Set(matches.map(item => item.trim())));
}

function numericTokens(text: string) {
  return (text.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).sort();
}

function sameMultiset(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function validateIntegrity(source: string, rewritten: string, chapter: NounChapterNumber) {
  const missingCitations = citationFragments(source).filter(fragment => !rewritten.includes(fragment));
  if (missingCitations.length) {
    throw new NounChapterHumanizerError(
      `The rewrite changed or removed ${missingCitations.length} in-text citation${missingCitations.length === 1 ? "" : "s"}. No file was produced; try again so citations remain exact.`,
      422,
    );
  }

  if (chapter === 4 || chapter === 5) {
    const before = numericTokens(source);
    const after = numericTokens(rewritten);
    if (!sameMultiset(before, after)) {
      throw new NounChapterHumanizerError(
        "The rewrite altered, removed or added numeric/statistical values. For Chapters Four and Five the data firewall requires every number to remain unchanged, so no file was produced.",
        422,
      );
    }
  }
}

function chapterGuidance(chapter: NounChapterNumber) {
  if (chapter === 1) return "Preserve the approved problem, objectives, questions/hypotheses, scope and definitions. Improve logical progression from background to research gap without changing the study's meaning.";
  if (chapter === 2) return "Preserve every author/year citation exactly. Improve synthesis, thematic flow, theory-to-study application, empirical comparison and research-gap clarity. Do not invent or delete studies, theories, findings, DOI links or references.";
  if (chapter === 3) return "Preserve the approved design, population, sample size, sampling method, instrument, validity/reliability, procedure, analysis method, software, ethics and limitations. Do not silently replace the methodology with a different design.";
  if (chapter === 4) return "This is a protected results chapter. Preserve every table label, respondent count, percentage, mean, standard deviation, coefficient, test statistic, p-value, quotation, theme and conclusion from the supplied data. Improve explanation and flow only; never manufacture or recalculate results.";
  return "Preserve every verified finding and numerical value. Keep conclusions and recommendations traceable to the supplied results and objectives. Do not add new findings, contributions or policy claims that are unsupported by the submitted chapter.";
}

function rewriteInstruction(depth: NounRewriteDepth) {
  if (depth === "light") return "Use a light edit: correct grammar, remove awkward repetition, improve transitions and natural academic flow while retaining much of the original wording.";
  if (depth === "deep") return "Use a deep rewrite: substantially vary sentence structure and wording, strengthen synthesis and coherence, and remove mechanical/repetitive phrasing while preserving the exact scholarly meaning and all protected evidence.";
  return "Use a balanced rewrite: noticeably improve wording, sentence variety, paragraph flow and scholarly readability while preserving the writer's meaning and evidence.";
}

async function rewriteChunk(options: {
  chunk: string;
  index: number;
  total: number;
  chapter: NounChapterNumber;
  depth: NounRewriteDepth;
  title: string;
  supervisorCorrections: string;
  extraInstructions: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro - NOUN Chapter Humanizer";
  }

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.25,
        messages: [
          {
            role: "system",
            content: [
              "You are a careful academic editor for National Open University of Nigeria (NOUN) thesis chapters.",
              "Your task is rewriting and human-centred academic editing, not inventing research content and not bypassing AI-detection systems.",
              rewriteInstruction(options.depth),
              chapterGuidance(options.chapter),
              "Preserve all Markdown headings and their numbering. Never delete, renumber or invent a thesis section unless the administrator explicitly requests it.",
              "Preserve every citation exactly as written, including author names, years and page numbers. Do not invent citations or references.",
              "Preserve quotations, proper names, dates, formulas, table/figure identifiers and research terminology.",
              "Keep formal Nigerian university academic English, varied sentence construction, precise transitions and natural paragraph rhythm. Avoid clichés, filler, generic signposting and repetitive sentence openings.",
              "Return only the rewritten chapter text, with no commentary, labels or code fences.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Research title: ${options.title || "Not supplied"}`,
              `Selected chapter: Chapter ${options.chapter}`,
              `Part ${options.index + 1} of ${options.total}`,
              options.supervisorCorrections ? `Supervisor corrections that must be respected:\n${options.supervisorCorrections}` : "",
              options.extraInstructions ? `Additional editing instructions:\n${options.extraInstructions}` : "",
              `Chapter text to rewrite:\n\n${options.chunk}`,
            ].filter(Boolean).join("\n\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) {
      throw new NounChapterHumanizerError(payload?.error?.message || "The AI chapter editor could not complete this rewrite.", 502);
    }
    const text = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!text) throw new NounChapterHumanizerError("The AI chapter editor returned an empty result.", 502);
    return text;
  } catch (error) {
    if (error instanceof NounChapterHumanizerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NounChapterHumanizerError("The chapter rewrite timed out. Try a shorter chapter or divide it by section.", 504);
    }
    console.error("NOUN chapter humanizer failed", error);
    throw new NounChapterHumanizerError("The NOUN chapter rewriter is temporarily unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function humanizeNounChapter(options: {
  text: string;
  chapter: NounChapterNumber;
  depth: NounRewriteDepth;
  title?: string;
  supervisorCorrections?: string;
  extraInstructions?: string;
}) {
  const source = options.text.trim();
  if (!source) throw new NounChapterHumanizerError("Paste the thesis chapter before rewriting it.", 400);
  if (source.length > 160_000) throw new NounChapterHumanizerError("This chapter is too long for one rewrite. Divide it into sections and process them separately.", 413);

  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new NounChapterHumanizerError("NOUN Chapter Rewriter & Humanizer requires AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel.", 503);
  }

  const chunks = chunkDocument(source);
  const transformed = new Array<string>(chunks.length);
  for (let start = 0; start < chunks.length; start += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(start, start + MAX_CONCURRENT_REQUESTS);
    const results = await Promise.all(batch.map((chunk, offset) => rewriteChunk({
      chunk,
      index: start + offset,
      total: chunks.length,
      chapter: options.chapter,
      depth: options.depth,
      title: options.title || "",
      supervisorCorrections: (options.supervisorCorrections || "").slice(0, 20_000),
      extraInstructions: (options.extraInstructions || "").slice(0, 10_000),
      apiKey,
      baseUrl,
      model,
    })));
    results.forEach((result, offset) => { transformed[start + offset] = result; });
  }

  const rewritten = transformed.join("\n\n").trim();
  validateIntegrity(source, rewritten, options.chapter);
  if (rewritten.replace(/\s+/g, " ") === source.replace(/\s+/g, " ")) {
    throw new NounChapterHumanizerError("The editor returned the original chapter unchanged. Try Balanced or Deep rewrite.", 422);
  }
  return rewritten;
}
