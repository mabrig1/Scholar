import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { CorpusSource } from "@/lib/integrity-corpus";
import { extractDocumentText } from "@/lib/extract-document-text";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 150_000;

export async function GET() {
  try {
    await connectMongoDB();
    const [total, submissions, institutions] = await Promise.all([
      CorpusSource.countDocuments(),
      CorpusSource.countDocuments({ sourceType: "submission" }),
      CorpusSource.distinct("institution", { institution: { $nin: [null, ""] } }),
    ]);
    const latest = await CorpusSource.find().select("title sourceType institution author year createdAt").sort({ createdAt: -1 }).limit(50).lean().exec();
    return NextResponse.json({ total, submissions, institutions: institutions.length, latest }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Integrity corpus summary failed", error);
    return NextResponse.json({ error: "Unable to load the integrity corpus." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectMongoDB();
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = String(form.get("text") || "").trim();
    let text = pastedText;
    let title = String(form.get("title") || "").trim();

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "Corpus uploads must be 4 MB or smaller." }, { status: 413 });
      const extracted = await extractDocumentText(file);
      if (!extracted.text) return NextResponse.json({ error: extracted.warning || "Unable to extract readable text." }, { status: 415 });
      text = extracted.text;
      if (!title) title = file.name;
    }

    if (text.length < 100) return NextResponse.json({ error: "Add at least 100 characters of permitted source text." }, { status: 400 });
    if (text.length > MAX_CHARS) return NextResponse.json({ error: "Corpus documents are limited to 150,000 extracted characters. Ingest a chapter or major section instead." }, { status: 413 });
    if (!title) return NextResponse.json({ error: "A source title is required." }, { status: 400 });

    const allowedTypes = new Set(["thesis", "project", "article", "submission", "institutional", "web"]);
    const rawType = String(form.get("sourceType") || "institutional").trim().toLowerCase();
    const sourceType = allowedTypes.has(rawType) ? rawType : "institutional";
    const fingerprint = createHash("sha256").update(text).digest("hex");
    const source = await CorpusSource.findOneAndUpdate(
      { fingerprint },
      { $setOnInsert: {
        title: title.slice(0, 500),
        text,
        sourceType,
        institution: String(form.get("institution") || "").trim().slice(0, 300) || undefined,
        author: String(form.get("author") || "").trim().slice(0, 300) || undefined,
        year: Number(form.get("year")) || undefined,
        url: String(form.get("url") || "").trim().slice(0, 1500) || undefined,
        fingerprint,
        metadata: { ingestion: "admin", permissionConfirmed: form.get("permissionConfirmed") === "yes" },
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return NextResponse.json({ ok: true, id: String(source._id), title: source.title, sourceType: source.sourceType });
  } catch (error) {
    console.error("Integrity corpus ingestion failed", error);
    return NextResponse.json({ error: "Unable to ingest this corpus document." }, { status: 500 });
  }
}
