import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Payment } from "@/lib/models";
import { verifyPaystack } from "@/lib/paystack";

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
    payment.paidAt = new Date();
    await payment.save();
    await Order.findByIdAndUpdate(payment.orderId, { status: "PAID" });
    return NextResponse.json({ ok: true, status: "PAID" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
