import { NextRequest, NextResponse } from "next/server";
import { searchOpenAlexSources } from "@/lib/journals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const access = params.get("access") ?? "all";
  const fee = params.get("fee") ?? "all";
  const impact = params.get("impact") ?? "all";

  try {
    let journals = await searchOpenAlexSources(q, 60);

    if (access === "oa") journals = journals.filter((j) => j.isOpenAccess || j.isInDoaj);
    if (access === "subscription") journals = journals.filter((j) => !j.isOpenAccess);
    if (fee === "free") journals = journals.filter((j) => j.feeStatus === "no-apc-listed");
    if (fee === "paid") journals = journals.filter((j) => j.feeStatus === "apc-listed");
    if (impact === "high") journals = journals.filter((j) => j.impactSignal === "high");

    journals.sort((a, b) => {
      const scoreA = (a.hIndex ?? 0) * 3 + (a.twoYearMeanCitedness ?? 0) * 20 + (a.isInDoaj ? 20 : 0);
      const scoreB = (b.hIndex ?? 0) * 3 + (b.twoYearMeanCitedness ?? 0) * 20 + (b.isInDoaj ? 20 : 0);
      return scoreB - scoreA;
    });

    return NextResponse.json({
      journals: journals.slice(0, 30),
      meta: {
        source: "OpenAlex",
        note: "Impact signal uses OpenAlex h-index and 2-year mean citedness; it is not a Clarivate Journal Impact Factor.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search journal registry." },
      { status: 502 },
    );
  }
}
