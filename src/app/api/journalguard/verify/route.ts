import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security";
import { verifyJournalV3 } from "../../../../lib/journalguard-v3";
import { parseBoundedJson } from "../../../../lib/journalguard-request";

export const runtime = "nodejs";
export const maxDuration = 30;
function error(code: number, message: string) {
  return NextResponse.json({ error: message }, { status: code, headers: { "Cache-Control": "no-store" } });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  // Per-instance limiting is a secondary control; configure a distributed edge/WAF
  // limit independently before exposing this endpoint to unrestricted traffic.
  const limited = rateLimit(request, "journalguard-verify-v1", 20);
  if (limited) return limited;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return error(415, "Content-Type must be application/json");
  }
  try {
    const body = await parseBoundedJson(request);
    if (!isRecord(body) || !isRecord(body.journal)) return error(400, "journal object required");
    const journal = body.journal;
    if (!["title","issn","website","publisher"].some(field =>
      typeof journal[field] === "string" && (journal[field] as string).trim().length > 0)) {
      return error(400, "At least one journal identity field required");
    }
    for (const field of ["title", "issn", "website", "publisher"]) {
      if (journal[field] !== undefined && (typeof journal[field] !== "string" || (journal[field] as string).length > 500)) {
        return error(400, "Invalid journal field");
      }
    }
    const article = body.article;
    if (article !== undefined && (!isRecord(article) ||
      ["doi", "title"].some(field => article[field] !== undefined &&
        (typeof article[field] !== "string" || (article[field] as string).length > 500)))) {
      return error(400, "Invalid article fields");
    }
    // Do not accept caller-supplied 'trusted domains': independence and source
    // governance must be established outside the user request.
    return NextResponse.json(await verifyJournalV3(journal, article as {doi?:string;title?:string}|undefined),
      { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    if (isRecord(caught) && (caught.code === 400 || caught.code === 413)) {
      return error(caught.code, String(caught.message || "Invalid request"));
    }
    return error(400, "Invalid request");
  }
}
