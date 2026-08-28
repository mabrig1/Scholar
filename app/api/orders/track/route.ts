import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Delivery, Order, Service, User } from "@/lib/models";

export const runtime = "nodejs";

type UserLookup = { _id: unknown } | null;
type OrderLookup = {
  _id: unknown;
  orderNumber?: string;
  status?: string;
  quotedAmount?: number | null;
  currency?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  serviceId?: unknown;
};
type ServiceLookup = { name?: string } | null;
type DeliveryLookup = { status?: string; location?: string } | null;

export async function POST(request: Request) {
  await connectMongoDB();
  const body = await request.json().catch(() => ({}));
  const orderNumber = String(body.orderNumber || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();
  if (!orderNumber || !whatsapp) return NextResponse.json({ error: "Order number and WhatsApp number are required." }, { status: 400 });

  const userResult = await User.findOne({ whatsapp }).lean().exec();
  const user = userResult as UserLookup;
  if (!user) return NextResponse.json({ error: "Order not found. Check the order number and WhatsApp number." }, { status: 404 });

  const orderResult = await Order.findOne({ orderNumber, userId: user._id }).lean().exec();
  const order = orderResult as OrderLookup | null;
  if (!order) return NextResponse.json({ error: "Order not found. Check the order number and WhatsApp number." }, { status: 404 });

  const [serviceResult, deliveryResult] = await Promise.all([
    Service.findById(order.serviceId).lean().exec(),
    Delivery.findOne({ orderId: order._id }).lean().exec(),
  ]);
  const service = serviceResult as ServiceLookup;
  const delivery = deliveryResult as DeliveryLookup;

  return NextResponse.json({ ok: true, order: { orderNumber: order.orderNumber, status: order.status, quotedAmount: order.quotedAmount, currency: order.currency, createdAt: order.createdAt, updatedAt: order.updatedAt, service: { name: service?.name || "Academic service" }, delivery: delivery ? { status: delivery.status, location: delivery.location } : null } });
}
