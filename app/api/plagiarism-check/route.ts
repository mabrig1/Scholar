import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { compareAgainstCorpus } from "@/lib/plagiarism-detector";
import { connectMongoDB } from "@/lib/mongodb";
import { CorpusSource, IntegrityScan } from "@/lib/integrity-corpus";
import { configuredEmbeddingProvider } from "@/lib/integrity-embeddings";
import { atlasVectorPipeline, semanticCandidates } from "@/lib/integrity-vector-search";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SUBMISSION_CHARS = 150_000;
const MAX_MANUAL_SOURCES = 40;
const MAX_SOURCE_CHARS = 60_000;
const MAX_TOTAL_SOURCE_CHARS = 600_000;
const MAX_PUBLIC_CORPUS_SOURCES = 40;

type IncomingSource = { id?: string; title?: string; text?: string; url?: string };
type CleanSource = { id: string; title: string; text: string; url?: string };
type CorpusRow = { _id: unknown; title?: string; text?: string; url?: string };

function safeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString().slice(0, 1000) : undefined;
  } catch {
    return undefined;
  }
}

function cleanSources(input: IncomingSource[]) {
  const sources: CleanSource[] = [];
  let totalChars = 0;
  let truncated = false;
  for (const source of input.slice(0, MAX_MANUAL_SOURCES)) {
    const rawText = String(source.text || "").trim();
    if (rawText.length < 50) continue;
    const remaining = MAX_TOTAL_SOURCE_CHARS - totalChars;
    if (remaining < 50) {
      truncated = true;
      break;
    }
    const text = rawText.slice(0, Math.min(MAX_SOURCE_CHARS, remaining));
    truncated ||= text.length < rawText.length;
    const index = sources.length + 1;
    sources.push({
      id: `manual-${index}`,
      title: String(source.title || `Reference ${index}`).trim().slice(0, 300),
      text,
      url: safeUrl(source.url),
    });
    totalChars += text.length;
  }
  truncated ||= input.length > MAX_MANUAL_SOURCES;
  return { sources, truncated };
}

function addCorpusRows(sources: CleanSource[], rows: CorpusRow[]) {
  const existing = new Set(sources.map((source) => source.id));
  for (const row of rows) {
    const sourceText = String(row.text || "").trim();
    const id = `corpus:${String(row._id)}`;
    if (sourceText.length < 50 || existing.has(id)) continue;
    sources.push({
      id,
      title: String(row.title || "Scholar corpus source").slice(0, 300),
      text: sourceText.slice(0, MAX_SOURCE_CHARS),
      url: safeUrl(row.url),
    });
    existing.add(id);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      text?: string;
      fileName?: string;
      sources?: IncomingSource[];
      institution?: string;
      useInstitutionalCorpus?: boolean;
      retainInCorpus?: boolean;
    };
    const text = String(body.text || "").trim();
    if (text.length < 100) {
      return NextResponse.json({ error: "Paste at least 100 characters to check." }, { status: 400 });
    }
    if (text.length > MAX_SUBMISSION_CHARS) {
      return NextResponse.json({ error: "Check a maximum of 150,000 characters at a time." }, { status: 413 });
    }

    const institution = String(body.institution || "").trim().slice(0, 300);
    const usePublicCorpus = body.useInstitutionalCorpus === true;
    const retainRequested = body.retainInCorpus === true;
    const cleaned = cleanSources(Array.isArray(body.sources) ? body.sources : []);
    const sources = cleaned.sources;
    let publicCorpusSources = 0;
    let corpusSelectionMode: "none" | "semantic" | "recent" | "unavailable" = "none";
    let corpusWarning: string | null = null;
    let persistenceAvailable = false;

    if (process.env.MONGODB_URI && (usePublicCorpus || retainRequested)) {
      try {
        await connectMongoDB();
        persistenceAvailable = true;
        if (usePublicCorpus) {
          const provider = configuredEmbeddingProvider();
          let rows: CorpusRow[] = [];
          if (provider) {
            try {
              const corpus = {
                async search(vector: number[], options: { limit?: number; institution?: string } = {}) {
                  const pipeline = atlasVectorPipeline(vector, {
                    index: process.env.INTEGRITY_VECTOR_INDEX || "scholar_integrity_vectors",
                    limit: Math.min(options.limit || 20, MAX_PUBLIC_CORPUS_SOURCES),
                    institution: options.institution,
                    publicOnly: true,
                  });
                  const docs = await CorpusSource.aggregate(pipeline).exec();
                  return docs.map((doc: Record<string, unknown>) => ({
                    id: String(doc._id),
                    title: String(doc.title || "Scholar corpus source"),
                    text: String(doc.text || ""),
                    url: doc.url ? String(doc.url) : undefined,
                    score: Number(doc.score || 0),
                  }));
                },
              };
              const candidates = await semanticCandidates(text, provider, corpus, {
                limit: 20,
                institution: institution || undefined,
              });
              rows = candidates.map((candidate) => ({
                _id: candidate.id,
                title: candidate.title,
                text: candidate.text,
                url: candidate.url,
              }));
              corpusSelectionMode = "semantic";
            } catch (error) {
              console.warn("Semantic corpus selection failed; falling back to recent public sources", error);
              corpusWarning = "Semantic retrieval was unavailable; Scholar used recent approved corpus sources instead.";
            }
          }
          if (!rows.length) {
            const filter: Record<string, unknown> = { publicComparisonAllowed: true };
            if (institution) filter.institution = institution;
            rows = await CorpusSource.find(filter)
              .select("title text url")
              .sort({ createdAt: -1 })
              .limit(MAX_PUBLIC_CORPUS_SOURCES)
              .lean()
              .exec() as unknown as CorpusRow[];
            corpusSelectionMode = "recent";
          }
          addCorpusRows(sources, rows);
          publicCorpusSources = rows.length;
        }
      } catch (error) {
        console.warn("Public comparison corpus unavailable; continuing with supplied sources", error);
        corpusSelectionMode = "unavailable";
        corpusWarning = "Scholar's approved public corpus was unavailable; only the supplied evidence sources were checked.";
      }
    } else if (usePublicCorpus) {
      corpusSelectionMode = "unavailable";
      corpusWarning = "Scholar's approved public corpus is not configured; only supplied evidence sources can be checked.";
    }

    if (!sources.length) {
      return NextResponse.json({
        error: "Add at least one evidence source. No source approved for anonymous comparison was available in the Scholar corpus.",
      }, { status: 400 });
    }

    const report = compareAgainstCorpus(text, sources);
    const documentHash = createHash("sha256").update(text).digest("hex");
    let scanId: string | null = null;
    let retainedInCorpus = false;
    let retainedEmbedded = false;

    if (persistenceAvailable) {
      try {
        const scan = await IntegrityScan.create({
          fileName: String(body.fileName || "").slice(0, 500) || undefined,
          documentHash,
          overallSimilarity: report.overallSimilarity,
          riskBand: report.risk,
          matchedWords: report.matchedWords,
          totalWords: report.totalWords,
          sourceCount: report.sourceSummaries.length,
          matchCount: report.matches.length,
          report,
        });
        scanId = String(scan._id);
      } catch (error) {
        console.warn("Scan history could not be saved", error);
      }

      if (retainRequested) {
        try {
          const provider = configuredEmbeddingProvider();
          let embedding: number[] | undefined;
          if (provider) {
            try {
              [embedding] = await provider.embed([text]);
              retainedEmbedded = Boolean(embedding);
            } catch (error) {
              console.warn("Retained submission embedding failed", error);
            }
          }
          await CorpusSource.findOneAndUpdate(
            { fingerprint: documentHash },
            { $setOnInsert: {
              title: String(body.fileName || "Retained submission").slice(0, 500),
              text,
              sourceType: "submission",
              institution: institution || undefined,
              fingerprint: documentHash,
              embedding,
              publicComparisonAllowed: false,
              metadata: {
                retainedWithExplicitConsent: true,
                publicComparisonAllowed: false,
                scanId,
                embeddingModel: embedding ? provider?.model : undefined,
                embeddingDimensions: embedding ? provider?.dimensions : undefined,
              },
            } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
          retainedInCorpus = true;
        } catch (error) {
          console.warn("Opted-in submission could not be retained", error);
        }
      }
    }

    return NextResponse.json({
      ...report,
      riskBand: report.risk,
      sources: report.sourceSummaries.map((source) => ({
        sourceId: source.sourceId,
        sourceTitle: source.sourceTitle,
        sourceUrl: source.sourceUrl,
        matchedWords: source.matchedWords,
        similarityContribution: source.similarity,
        passageCount: source.matches,
      })),
      scanId,
      publicCorpusSources,
      institutionalSources: publicCorpusSources,
      corpusSelectionMode,
      corpusWarning,
      sourceInputTruncated: cleaned.truncated,
      retainedInCorpus,
      retainedEmbedded,
      persistenceAvailable,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Similarity check failed", error);
    return NextResponse.json({ error: "Unable to complete the similarity check." }, { status: 500 });
  }
}
