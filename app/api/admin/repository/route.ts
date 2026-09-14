import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { listPendingRepositoryWorks, moderateRepositoryWork } from "@/lib/open-repository-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const works = await listPendingRepositoryWorks(100);
    return NextResponse.json({ works }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load repository queue." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const action = String(body.action ?? "").trim();
    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Submission ID and valid moderation action are required." }, { status: 400 });
    }

    const work = await moderateRepositoryWork({
      id,
      action: action as "approve" | "reject",
      note: String(body.note ?? "").slice(0, 2000),
      rightsReviewed: Boolean(body.rightsReviewed),
      metadataReviewed: Boolean(body.metadataReviewed),
    });

    return NextResponse.json(
      { ok: true, id: String(work._id), status: work.status, slug: work.slug },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Repository moderation failed." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
