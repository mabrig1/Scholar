import { notFound } from "next/navigation";
import { getPublishedPdf } from "@/lib/open-repository-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const work = await getPublishedPdf(slug);
  if (!work?.fileData) notFound();

  const body = new Uint8Array(work.fileData.buffer, work.fileData.byteOffset, work.fileData.byteLength);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(work.sizeBytes || body.byteLength),
      "Content-Disposition": `inline; filename="${String(work.fileName || "research.pdf").replace(/"/g, "")}"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
