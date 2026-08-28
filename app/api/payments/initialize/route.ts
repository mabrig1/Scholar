import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Payment } from "@/lib/models";
import { initializePaystack } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectMongoDB();
    const { orderNumber, email } = await request.json();
    if (!orderNumber || !email) return NextResponse.json({ error: "Order number and email are required." }, { status: 400 });
    const order = await Order.findOne({ orderNumber });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (!order.quotedAmount) return NextResponse.json({ error: "This order has not been quoted yet." }, { status: 409 });
    const existing = await Payment.findOne({ orderId: order._id });
    if (existing?.status === "PAID") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });

    const reference = `MAB-${order.orderNumber}-${Date.now()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/payment/callback`;
    const payment = await initializePaystack({ email, amountNaira: order.quotedAmount, reference, callbackUrl });
    await Payment.findOneAndUpdate({ orderId: order._id }, { orderId: order._id, reference, amount: order.quotedAmount, status: "PENDING" }, { upsert: true, new: true, setDefaultsOnInsert: true });
    order.status = "AWAITING_PAYMENT";
    await order.save();
    return NextResponse.json({ ok: true, authorizationUrl: payment.authorization_url, reference });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment initialization failed." }, { status: 500 });
  }
}
