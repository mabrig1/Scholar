import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Payment } from "@/lib/models";
import { reportMabrigConversion } from "@/lib/mabrig-growth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack is not configured." }, { status: 500 });
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  if (signature !== expected) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  await connectMongoDB();
  const event = JSON.parse(raw);
  if (event.event === "charge.success") {
    const reference = String(event.data?.reference || "");
    const amount = Number(event.data?.amount || 0);
    const payment = await Payment.findOne({ reference });
    if (payment && amount === payment.amount * 100) {
      payment.status = "PAID";
      payment.paidAt = new Date(event.data?.paid_at || Date.now());
      await payment.save();
      const order = await Order.findByIdAndUpdate(
        payment.orderId,
        { status: "PAID" },
        { new: true }
      ).select("orderNumber");

      if (!payment.growthConversionReportedAt && payment.customerEmail) {
        const report = await reportMabrigConversion({
          id: `scholar:paystack:${payment.reference}`,
          type: "purchase",
          email: payment.customerEmail,
          amount: payment.amount,
          currency: String(event.data?.currency || "NGN"),
          attributionToken: payment.attributionToken || undefined,
          product: "Mabrig Researcher Pro Academic Service",
          reference: order?.orderNumber || payment.reference,
          occurredAt: payment.paidAt.toISOString(),
          source: "scholar:paystack",
        });
        if (report.reported) {
          payment.growthConversionReportedAt = new Date();
          await payment.save();
        }
      }
    }
  }
  return NextResponse.json({ received: true });
}
