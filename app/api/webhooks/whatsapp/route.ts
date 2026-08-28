import { NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge || "", { status: 200 });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.entry?.flatMap((entry: any) => entry.changes || []).flatMap((change: any) => change.value?.messages || []) || [];
    for (const message of messages) {
      if (message.type !== "text" || !message.from) continue;
      const text = String(message.text?.body || "").trim().toLowerCase();
      const reply = text === "track"
        ? "Send: TRACK MAB-YYYYMMDD-12345 to check your order."
        : "Welcome to MABRIG Academic Assistance. Reply ORDER to start an order, TRACK to check an order, or SUPPORT for help.";
      await sendWhatsAppText(message.from, reply);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return NextResponse.json({ received: true });
  }
}
