import { NextRequest, NextResponse } from "next/server";
import { findCrossrefJournals, searchOpenAlexSources, verifyCrossrefIssn } from "@/lib/journals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const title = (request.nextUrl.searchParams.get("title") ?? "").trim();
  const issn = (request.nextUrl.searchParams.get("issn") ?? "").trim();

  if (!title && !issn) {
    return NextResponse.json({ error: "Enter a journal title or ISSN." }, { status: 400 });
  }

  try {
    const [openAlexResults, crossrefByIssn, crossrefByTitle] = await Promise.all([
      searchOpenAlexSources(issn || title, 8),
      issn ? verifyCrossrefIssn(issn) : Promise.resolve(null),
      !issn && title ? findCrossrefJournals(title) : Promise.resolve([]),
    ]);

    const source = openAlexResults[0] ?? null;
    const crossref = crossrefByIssn ?? crossrefByTitle[0] ?? null;

    let score = 0;
    const evidence: string[] = [];
    const cautions: string[] = [];

    if (source) {
      score += 40;
      evidence.push("Journal/source found in OpenAlex scholarly registry.");
      if (source.issn.length) {
        score += 10;
        evidence.push(`ISSN record present: ${source.issn.join(", ")}.`);
      }
      if (source.isInDoaj) {
        score += 20;
        evidence.push("OpenAlex marks this source as indexed in DOAJ.");
      }
      if ((source.worksCount ?? 0) > 0) {
        score += 5;
        evidence.push("Published scholarly works are associated with the source.");
      }
    } else {
      cautions.push("No close OpenAlex journal record was found from the supplied identifier.");
    }

    if (crossref) {
      score += 25;
      evidence.push("Crossref journal metadata was found, supporting DOI/ISSN registration evidence.");
    } else {
      cautions.push("No matching Crossref journal metadata was confirmed.");
    }

    score = Math.min(score, 100);
    const status = score >= 80 ? "verified-evidence" : score >= 50 ? "established-evidence" : "caution";

    if (!source?.isInDoaj && source?.isOpenAccess) {
      cautions.push("The source appears open access, but DOAJ inclusion was not confirmed by the registry data returned.");
    }
    if (source?.feeStatus === "unknown") {
      cautions.push("APC/fee data is unavailable; do not assume the journal is free.");
    }
    cautions.push("A registry check reduces risk but cannot prove that a journal is non-predatory. Confirm editorial board, peer-review policy, fees, publisher identity, and official indexing claims before payment or submission.");

    return NextResponse.json({
      score,
      status,
      evidence,
      cautions,
      journal: source,
      crossref,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification service failed." },
      { status: 502 },
    );
  }
}
