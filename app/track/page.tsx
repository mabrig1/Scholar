"use client";

import { FormEvent, useState } from "react";

export default function TrackPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: form.get("orderNumber"), whatsapp: form.get("whatsapp") }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Unable to find order.");
    setResult(data.order);
  }

  return <main className="section container"><div className="order card"><span className="badge">MABRIG ORDER TRACKING</span><h1 style={{fontSize:42}}>Track your order</h1><p>Enter the order number and the WhatsApp number used when the order was created.</p>
    <form onSubmit={submit}><div className="form-grid"><label className="field"><span>Order number</span><input name="orderNumber" required placeholder="MAB-20260815-12345" /></label><label className="field"><span>WhatsApp number</span><input name="whatsapp" required placeholder="080..." /></label></div><button className="btn primary" style={{marginTop:16}}>Track Order</button></form>
    {error && <p className="notice" style={{marginTop:16}}>{error}</p>}
    {result && <div className="card" style={{marginTop:20}}><h2>{result.orderNumber}</h2><p><strong>Service:</strong> {result.service.name}</p><p><strong>Status:</strong> {result.status}</p>{result.quotedAmount !== null && <p><strong>Quotation:</strong> ₦{result.quotedAmount.toLocaleString()}</p>}{result.delivery && <p><strong>Delivery:</strong> {result.delivery.status} — {result.delivery.location}</p>}<p><strong>Last updated:</strong> {new Date(result.updatedAt).toLocaleString()}</p></div>}
  </div></main>;
}
