export type DocumentTransformationMode = "format" | "proofread" | "write-assignment" | "rewrite-assignment";

type DocumentEditingMode = Exclude<DocumentTransformationMode, "format" | "write-assignment">;

const AI_TIMEOUT_MS = 75_000;
const MAX_CHUNK_CHARS = 14_000;
const MAX_CONCURRENT_REQUESTS = 3;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export class DocumentTransformationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DocumentTransformationError";
  }
}

export function parseDocumentTransformationMode(value: unknown): DocumentTransformationMode {
  if (value === "write-assignment") return "write-assignment";
  if (value === "rewrite" || value === "rewrite-assignment") return "rewrite-assignment";
  return value === "proofread" ? "proofread" : "format";
}

function normalizeForComparison(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function endpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

async function transformChunk(options: {
  chunk: string;
  index: number;
  total: number;
  mode: DocumentEditingMode;
  title?: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const modeInstruction = options.mode === "rewrite-assignment"
    ? "Rewrite the complete assignment with substantially different sentence structure and wording while preserving every meaning, fact, figure, quotation, citation, heading and reference. Improve coherence between sections and maintain an appropriate academic voice."
    : "Correct grammar, punctuation and awkward phrasing; improve clarity, flow and academic tone while preserving the writer's voice and approximately the same length.";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro";
  }

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              "You are a careful academic editor.",
              modeInstruction,
              "Never invent or remove evidence, citations, references, names, dates, numbers or claims.",
              "Keep Markdown headings, lists, blockquotes and emphasis markers structurally intact because a Word renderer will interpret them later.",
              "Return only the revised document text. Do not add commentary, labels or code fences.",
            ].join(" "),
          },
          {
            role: "user",
            content: `${options.title ? `Document title: ${options.title}\n` : ""}Document part ${options.index + 1} of ${options.total}:\n\n${options.chunk}`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) {
      console.error("AI document transformation provider error", {
        status: response.status,
        message: payload?.error?.message,
      });
      throw new DocumentTransformationError(
        "The AI editor could not process this document. Check the configured provider, model and credit balance, then try again.",
        502,
      );
    }

    const transformed = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!transformed) {
      throw new DocumentTransformationError("The AI editor returned an empty result. Please try again.", 502);
    }
    return transformed;
  } catch (error) {
    if (error instanceof DocumentTransformationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new DocumentTransformationError("The AI editor timed out. Try a shorter document or try again.", 504);
    }
    console.error("AI document transformation request failed", error);
    throw new DocumentTransformationError("The AI editor is temporarily unavailable. Please try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function writeAssignmentDraft(options: {
  text: string;
  title?: string;
  instructions?: string;
  targetPages?: number;
  citationsRequested?: boolean;
  referencesRequested?: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const targetPages = Math.min(20, Math.max(1, Math.round(Number(options.targetPages) || 3)));
  const targetWords = Math.min(6_000, Math.max(700, targetPages * 350));
  const assignmentBrief = (options.instructions || "").trim();
  const sourceNotes = options.text.trim().slice(0, 28_000);

  if (!options.title?.trim() && !assignmentBrief && !sourceNotes) {
    throw new DocumentTransformationError("Add an assignment topic or brief before using Write Assignment.", 400);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro";
  }

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.3,
        max_tokens: Math.min(12_000, Math.max(2_000, Math.ceil(targetWords * 1.8))),
        messages: [
          {
            role: "system",
            content: [
              "You are a careful university assignment drafting assistant.",
              "Create a complete, original academic draft for the student to review, fact-check and adapt.",
              "Use a clear title, introduction, logically ordered Markdown headings and subheadings, developed body paragraphs, and a conclusion.",
              "Do not fabricate sources, citations, quotations, statistics, findings or references.",
              "Use only evidence explicitly supplied in the brief or source notes.",
              "When citations or references are requested but verified sources were not supplied, use clear [Insert verified citation] or [Add verified source] placeholders instead of inventing them.",
              "Return only the assignment text with Markdown structure; do not add commentary or code fences.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Assignment title/topic: ${options.title?.trim() || "Use the brief to create a suitable title"}`,
              `Target length: approximately ${targetWords} words (${targetPages} page${targetPages === 1 ? "" : "s"})`,
              `Citations requested: ${options.citationsRequested ? "yes" : "no"}`,
              `Reference list requested: ${options.referencesRequested ? "yes" : "no"}`,
              assignmentBrief ? `Assignment instructions:\n${assignmentBrief}` : "",
              sourceNotes ? `Supplied source notes or material:\n${sourceNotes}` : "",
            ].filter(Boolean).join("\n\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) {
      console.error("AI assignment writing provider error", {
        status: response.status,
        message: payload?.error?.message,
      });
      throw new DocumentTransformationError(
        "The AI assignment writer could not complete this draft. Check the configured provider, model and credit balance, then try again.",
        502,
      );
    }

    const generated = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!generated) {
      throw new DocumentTransformationError("The AI assignment writer returned an empty draft. Please try again.", 502);
    }
    return generated;
  } catch (error) {
    if (error instanceof DocumentTransformationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new DocumentTransformationError("The AI assignment writer timed out. Try fewer pages or try again.", 504);
    }
    console.error("AI assignment writing request failed", error);
    throw new DocumentTransformationError("The AI assignment writer is temporarily unavailable. Please try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function transformAcademicText(options: {
  text: string;
  mode: DocumentTransformationMode;
  title?: string;
  instructions?: string;
  targetPages?: number;
  citationsRequested?: boolean;
  referencesRequested?: boolean;
}) {
  if (options.mode === "format") return { text: options.text, changed: false };

  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new DocumentTransformationError(
      "AI rewriting is not configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL, or choose Format only.",
      503,
    );
  }

  if (options.mode === "write-assignment") {
    const text = await writeAssignmentDraft({
      ...options,
      apiKey,
      baseUrl,
      model,
    });
    return { text, changed: true };
  }

  const mode: DocumentEditingMode = options.mode;
  if (!options.text.trim()) {
    throw new DocumentTransformationError("Upload or paste an assignment before using an editing mode.", 400);
  }

  const chunks = chunkDocument(options.text);
  const transformed = new Array<string>(chunks.length);

  for (let start = 0; start < chunks.length; start += MAX_CONCURRENT_REQUESTS) {
    const batch = chunks.slice(start, start + MAX_CONCURRENT_REQUESTS);
    const results = await Promise.all(batch.map((chunk, offset) => transformChunk({
      chunk,
      index: start + offset,
      total: chunks.length,
      mode,
      title: options.title,
      apiKey,
      baseUrl,
      model,
    })));
    results.forEach((result, offset) => {
      transformed[start + offset] = result;
    });
  }

  const text = transformed.join("\n\n").trim();
  const changed = normalizeForComparison(text) !== normalizeForComparison(options.text);
  if (!changed) {
    throw new DocumentTransformationError(
      "The AI editor returned the original wording unchanged. Choose Rewrite for clarity or try another model.",
      422,
    );
  }

  return { text, changed };
}
