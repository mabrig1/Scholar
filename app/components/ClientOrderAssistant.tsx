"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type SavedOrder = { orderNumber: string; whatsapp: string };
type ChatMessage = { id: string; role: "assistant" | "client"; text: string };

const helpReplies: Record<string, string> = {
  submit: "Complete the order form, upload a supported document or paste the text, add your deadline and instructions, then select Submit. You will receive an order number immediately.",
  formatting: "UNN formatting is the default: Times New Roman, 12pt, 1.5 spacing, justified paragraphs, first-line body indents, bold headings and hanging reference indents. APA 7 and MLA 9 are also available.",
  delivery: "Choose digital only, print only, format plus print, or campus delivery. For delivery, select your UNN location and add a hostel, block or meeting-point note.",
  status: "Use Track Order with your order number and the WhatsApp number used during submission. I can also attach a new instruction to an existing order here.",
};

function chatId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ClientOrderAssistant() {
  const [open, setOpen] = useState(false);
  const [savedOrder, setSavedOrder] = useState<SavedOrder | null>(null);
  const [showInstructionForm, setShowInstructionForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: "Hello! I am the Mabrig submission assistant. I can guide your order, explain formatting and send additional instructions to the print shop." },
  ]);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSavedOrder = () => {
      try {
        const saved = window.localStorage.getItem("mabrig_latest_order");
        if (saved) setSavedOrder(JSON.parse(saved) as SavedOrder);
      } catch { /* Ignore invalid local storage data. */ }
    };
    loadSavedOrder();

    const submitted = (event: Event) => {
      const detail = (event as CustomEvent<SavedOrder>).detail;
      if (!detail?.orderNumber) return;
      setSavedOrder(detail);
      setOpen(true);
      setMessages(current => [...current, {
        id: chatId(),
        role: "assistant",
        text: `Your work has been submitted successfully. Order ${detail.orderNumber} is now with Mabrig Researcher Pro. If you remember another requirement, send it here and it will be attached to this order.`,
      }]);
    };
    window.addEventListener("mabrig-order-submitted", submitted);
    return () => window.removeEventListener("mabrig-order-submitted", submitted);
  }, []);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, showInstructionForm]);

  function addHelp(topic: keyof typeof helpReplies, label: string) {
    setMessages(current => [
      ...current,
      { id: chatId(), role: "client", text: label },
      { id: chatId(), role: "assistant", text: helpReplies[topic] },
    ]);
  }

  async function sendInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const orderNumber = String(data.get("orderNumber") || "").trim();
    const whatsapp = String(data.get("whatsapp") || "").trim();
    const instruction = String(data.get("message") || "").trim();
    if (!orderNumber || !whatsapp || !instruction) return;

    setSending(true);
    const response = await fetch("/api/orders/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, whatsapp, message: instruction }),
    });
    const result = await response.json().catch(() => ({}));
    setSending(false);
    setMessages(current => [
      ...current,
      { id: chatId(), role: "client", text: instruction },
      { id: chatId(), role: "assistant", text: response.ok ? result.message : (result.error || "I could not send that instruction. Please try again.") },
    ]);
    if (response.ok) {
      const order = { orderNumber: result.orderNumber || orderNumber, whatsapp };
      setSavedOrder(order);
      window.localStorage.setItem("mabrig_latest_order", JSON.stringify(order));
      form.reset();
      setShowInstructionForm(false);
    }
  }

  return <div className="client-assistant">
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="mabrig-assistant-title">
      <header className="assistant-header">
        <div><span>ONLINE GUIDE</span><strong id="mabrig-assistant-title">Mabrig Assistant</strong></div>
        <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)}>×</button>
      </header>

      <div className="assistant-stream" ref={streamRef} aria-live="polite">
        {messages.map(message => <div key={message.id} className={`assistant-message ${message.role}`}>{message.text}</div>)}

        <div className="assistant-suggestions" aria-label="Common questions">
          <button type="button" onClick={() => addHelp("submit", "How do I submit work?")}>How to submit</button>
          <button type="button" onClick={() => addHelp("formatting", "Explain formatting options")}>Formatting</button>
          <button type="button" onClick={() => addHelp("delivery", "Explain printing and delivery")}>Printing & delivery</button>
          <button type="button" onClick={() => addHelp("status", "How do I track my order?")}>Track order</button>
        </div>

        {showInstructionForm && <form className="assistant-instruction-form" onSubmit={sendInstruction}>
          <strong>Send additional instructions</strong>
          <label><span>Order number</span><input name="orderNumber" required defaultValue={savedOrder?.orderNumber || ""} placeholder="MAB-20260828-12345" /></label>
          <label><span>WhatsApp number used</span><input name="whatsapp" required defaultValue={savedOrder?.whatsapp || ""} inputMode="tel" placeholder="080..." /></label>
          <label><span>New instruction</span><textarea name="message" required minLength={3} maxLength={2000} placeholder="Example: Please use APA 7 and add a cover page." /></label>
          <button className="btn primary" type="submit" disabled={sending}>{sending ? "Sending..." : "Send to print shop"}</button>
        </form>}
      </div>

      <footer className="assistant-footer">
        {savedOrder && <small>Current order: <strong>{savedOrder.orderNumber}</strong></small>}
        <button className="btn primary" type="button" onClick={() => setShowInstructionForm(value => !value)}>{showInstructionForm ? "Close instruction form" : "Add instruction to an order"}</button>
        <a href="/track">Track an order</a>
      </footer>
    </section>}

    <button className="assistant-launcher" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span aria-hidden="true">💬</span><strong>{open ? "Close guide" : "Need help?"}</strong>
    </button>
  </div>;
}
