import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Delivery, Order, OrderFile, Service, User } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectMongoDB();
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const whatsapp = String(form.get("whatsapp") || "").trim();
    const department = String(form.get("department") || "").trim() || null;
    const serviceName = String(form.get("service") || "").trim();
    const instructions = String(form.get("instructions") || "").trim();
    const file = form.get("file");
    if (!name || !whatsapp || !serviceName || !instructions) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    if (file instanceof File && file.size > 4_000_000) return NextResponse.json({ error: "Uploads must be 4MB or smaller." }, { status: 413 });

    const service = await Service.findOneAndUpdate({ name: serviceName }, { $setOnInsert: { name: serviceName } }, { upsert: true, new: true });
    const user = await User.findOneAndUpdate({ whatsapp }, { $set: { name, department, optedIn: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const orderNumber = `MAB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(10000 + Math.random() * 90000)}`;
    const order = await Order.create({ orderNumber, userId: user._id, serviceId: service._id, instructions });
    if (file instanceof File && file.size > 0) {
      await OrderFile.create({
        orderId: order._id,
        fileName: file.name,
        storageKey: `mongodb/${orderNumber}/${file.name}`,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        data: Buffer.from(await file.arrayBuffer()),
      });
    }

    return NextResponse.json({ ok: true, orderId: order.orderNumber, status: order.status });
  } catch (error) {
    console.error("Order creation failed", error);
    return NextResponse.json({ error: "We could not create the order. Check MONGODB_URI and try again." }, { status: 500 });
  }
}
