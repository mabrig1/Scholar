import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { getPendingRepositoryPdf } from "@/lib/open-repository-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  if (!requestHasAdminSession(request)) return new Response("Unauthorized.", { status: 401 });
  const { id } = await params;
  const work = await getPendingRepositoryPdf(id);
  if (!work?.fileData) notFound();

  const body = new Uint8Array(work.fileData.buffer, work.fileData.byteOffset, work.fileData.byteLength);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(work.fileName || "submission.pdf").replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
