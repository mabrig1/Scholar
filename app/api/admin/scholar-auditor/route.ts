import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { auditScholarCompatibility } from "@/lib/scholar-auditor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientName = String(body.clientName ?? "").trim();
    const articleUrl = String(body.articleUrl ?? "").trim();
    const expectedTitle = String(body.expectedTitle ?? "").trim();
    const expectedDoi = String(body.expectedDoi ?? "").trim();

    if (!articleUrl) {
      return NextResponse.json({ error: "Paste the public article landing-page URL to run the live audit." }, { status: 400 });
    }

    const result = await auditScholarCompatibility({ clientName, articleUrl, expectedTitle, expectedDoi });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Scholar compatibility audit failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
