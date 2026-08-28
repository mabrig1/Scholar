import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { auditCitations } from "@/lib/citation-auditor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const references = String(body.references ?? "").trim();
    if (!references) {
      return NextResponse.json({ error: "Paste the manuscript reference list to run the citation audit." }, { status: 400 });
    }
    const result = await auditCitations(references);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Citation integrity audit failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
