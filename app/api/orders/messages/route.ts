import { after, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, OrderMessage, User } from "@/lib/models";
import { notifyAdminOfClientMessage } from "@/lib/order-notifications";

export const runtime = "nodejs";

function phoneCandidates(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
  const international = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return Array.from(new Set([raw, digits, local, international, international ? `+${international}` : ""].filter(Boolean)));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderNumber = String(body.orderNumber || "").trim().toUpperCase().slice(0, 64);
    const whatsapp = String(body.whatsapp || "").trim().slice(0, 40);
    const message = String(body.message || "").trim().slice(0, 2000);

    if (!orderNumber || !whatsapp || !message) {
      return NextResponse.json({ error: "Order number, WhatsApp number and instruction are required." }, { status: 400 });
    }
    if (message.length < 3) {
      return NextResponse.json({ error: "Please provide a clearer instruction." }, { status: 400 });
    }

    await connectMongoDB();

    const userResult = await User.findOne({ whatsapp: { $in: phoneCandidates(whatsapp) } }).lean().exec();
    const user = userResult as { _id: unknown; name?: string; whatsapp?: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Order not found. Check the order number and WhatsApp number used during submission." }, { status: 404 });
    }

    const orderResult = await Order.findOne({ orderNumber, userId: user._id }).lean().exec();
    const order = orderResult as { _id: unknown; orderNumber?: string; status?: string } | null;
    if (!order) {
      return NextResponse.json({ error: "Order not found. Check the order number and WhatsApp number used during submission." }, { status: 404 });
    }

    const recentCount = await OrderMessage.countDocuments({
      orderId: order._id,
      sender: "CLIENT",
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recentCount >= 10) {
      return NextResponse.json({ error: "Too many messages were sent recently. Please wait before sending another instruction." }, { status: 429 });
    }

    const notificationStatus = {
      whatsapp: process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID ? "pending" : "not_configured",
      telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID ? "pending" : "not_configured",
    };
    const savedMessage = await OrderMessage.create({ orderId: order._id, sender: "CLIENT", body: message, notificationStatus });
    await Order.updateOne({ _id: order._id }, { $set: { lastClientMessageAt: new Date() } });

    after(async () => {
      try {
        const status = await notifyAdminOfClientMessage({
          orderNumber: order.orderNumber || orderNumber,
          studentName: user.name || "Client",
          studentWhatsapp: user.whatsapp || whatsapp,
          message,
        });
        await OrderMessage.updateOne({ _id: savedMessage._id }, { $set: { notificationStatus: status } });
      } catch (error) {
        console.error("Unable to notify admin of client instruction", error);
      }
    });

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber || orderNumber,
      message: "Your additional instruction was received and attached to your order.",
    });
  } catch (error) {
    console.error("Client order-message submission failed", error);
    return NextResponse.json({ error: "We could not send your instruction. Please try again." }, { status: 500 });
  }
}
