import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Payment } from "@/lib/models";
import { verifyPaystack } from "@/lib/paystack";
import { reportMabrigConversion } from "@/lib/mabrig-growth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectMongoDB();
    const { reference } = await request.json();
    if (!reference) return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });
    const result = await verifyPaystack(reference);
    const payment = await Payment.findOne({ reference });
    if (!payment) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    const paid = result.status === "success" && Number(result.amount) === payment.amount * 100;
    if (!paid) {
      payment.status = "FAILED";
      await payment.save();
      return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
    }
    payment.status = "PAID";
    payment.paidAt = new Date(result.paid_at || Date.now());
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
        currency: String(result.currency || "NGN"),
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

    return NextResponse.json({ ok: true, status: "PAID" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
