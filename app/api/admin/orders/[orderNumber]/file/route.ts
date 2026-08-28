import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, OrderFile } from "@/lib/models";
import { attachmentContentDisposition, safeOriginalAttachmentFilename } from "@/lib/download-filename";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber || "").trim();
    if (!orderNumber) return NextResponse.json({ error: "Order number is required." }, { status: 400 });

    await connectMongoDB();
    const result = await Order.findOne({ orderNumber }).select("_id").lean().exec();
    const order = result as unknown as { _id: unknown } | null;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const file = await OrderFile.findOne({ orderId: order._id }).select("+data fileName mimeType").exec();
    if (!file) return NextResponse.json({ error: "No submitted file is attached to this order." }, { status: 404 });
    if (!file.data?.length) {
      return NextResponse.json(
        { error: "This older order saved only file metadata, so the original upload cannot be recovered. New submissions are stored and downloadable." },
        { status: 410 },
      );
    }

    const filename = safeOriginalAttachmentFilename(file.fileName || `${orderNumber}-submitted-file`);
    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(file.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Submitted file download failed", error);
    return NextResponse.json({ error: "Unable to download the submitted file." }, { status: 500 });
  }
}
