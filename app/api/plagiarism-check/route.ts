import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { compareAgainstCorpus } from "@/lib/plagiarism-detector";
import { connectMongoDB } from "@/lib/mongodb";
import { CorpusSource, IntegrityScan } from "@/lib/integrity-corpus";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingSource = { id?: string; title?: string; text?: string; url?: string };
type CorpusRow = { _id: unknown; title?: string; text?: string; url?: string };

function cleanSources(input: IncomingSource[]) {
  return input.filter((s) => String(s.text || "").trim().length >= 50).slice(0, 250).map((s, i) => ({
    id: String(s.id || `manual-${i + 1}`),
    title: String(s.title || `Reference ${i + 1}`).slice(0, 300),
    text: String(s.text || "").slice(0, 120_000),
    url: s.url ? String(s.url).slice(0, 1000) : undefined,
  }));
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
    if (text.length < 100) return NextResponse.json({ error: "Paste at least 100 characters to check." }, { status: 400 });
    if (text.length > 150_000) return NextResponse.json({ error: "Check a maximum of 150,000 characters at a time." }, { status: 413 });

    const institution = String(body.institution || "").trim().slice(0, 300);
    const sources = cleanSources(body.sources || []);
    let institutionalSources = 0;
    let persistenceAvailable = false;

    if (process.env.MONGODB_URI && (body.useInstitutionalCorpus || body.retainInCorpus)) {
      try {
        await connectMongoDB();
        persistenceAvailable = true;
        if (body.useInstitutionalCorpus) {
          const filter = institution ? { institution } : {};
          const rows = await CorpusSource.find(filter).select("title text url").sort({ createdAt: -1 }).limit(40).lean().exec() as unknown as CorpusRow[];
          const existing = new Set(sources.map((source) => source.id));
          for (const row of rows) {
            const sourceText = String(row.text || "").trim();
            const id = `corpus:${String(row._id)}`;
            if (sourceText.length >= 50 && !existing.has(id)) sources.push({ id, title: String(row.title || "Institutional source"), text: sourceText.slice(0, 120_000), url: row.url || undefined });
          }
          institutionalSources = rows.length;
        }
      } catch (error) {
        console.warn("Institutional corpus unavailable; continuing with supplied sources", error);
      }
    }

    if (!sources.length) return NextResponse.json({ error: "Add at least one evidence source or enable an institutional corpus that already contains documents." }, { status: 400 });

    const report = compareAgainstCorpus(text, sources);
    const documentHash = createHash("sha256").update(text).digest("hex");
    let scanId: string | null = null;

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
        if (body.retainInCorpus) {
          await CorpusSource.findOneAndUpdate(
            { fingerprint: documentHash },
            { $setOnInsert: { title: String(body.fileName || "Retained submission").slice(0, 500), text, sourceType: "submission", institution: institution || undefined, fingerprint: documentHash, metadata: { retainedWithExplicitConsent: true, scanId } } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }
      } catch (error) {
        console.warn("Scan history could not be saved", error);
      }
    }

    return NextResponse.json({
      ...report,
      riskBand: report.risk,
      sources: report.sourceSummaries.map((source) => ({ sourceId: source.sourceId, sourceTitle: source.sourceTitle, sourceUrl: source.sourceUrl, matchedWords: source.matchedWords, similarityContribution: source.similarity, passageCount: source.matches })),
      scanId,
      institutionalSources,
      retainedInCorpus: Boolean(body.retainInCorpus && persistenceAvailable),
      persistenceAvailable,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Similarity check failed", error);
    return NextResponse.json({ error: "Unable to complete the similarity check." }, { status: 500 });
  }
}
