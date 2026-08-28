import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const chatId = update.message?.chat?.id;
    const text = String(update.message?.text || "").trim().toLowerCase();
    if (!chatId) return NextResponse.json({ received: true });
    const reply = text === "/start"
      ? "Welcome to MABRIG Academic Assistance. Use the website to place an order, or send TRACK followed by your order number."
      : text.startsWith("track")
        ? "Order tracking is available at the MABRIG website. Send your order number and WhatsApp number there for secure verification."
        : "MABRIG Academic Assistance: academic support, document formatting, printing, binding and UNN campus delivery. Use /start for help.";
    await sendTelegramMessage(chatId, reply);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Telegram webhook error", error);
    return NextResponse.json({ received: true });
  }
}
