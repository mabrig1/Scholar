import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Payment } from "@/lib/models";

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
      payment.paidAt = new Date();
      await payment.save();
      await Order.findByIdAndUpdate(payment.orderId, { status: "PAID" });
    }
  }
  return NextResponse.json({ received: true });
}
