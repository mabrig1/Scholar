"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentCallbackContent() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Verifying your payment...");
  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return setMessage("No payment reference was supplied.");
    fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => setMessage(ok ? "Payment confirmed. Your order is now PAID and has entered the operations queue." : (data.error || "Payment could not be verified.")))
      .catch(() => setMessage("Payment verification could not be completed. Please contact MABRIG support."));
  }, [params]);
  return <main className="section container"><div className="card order"><span className="badge">MABRIG PAYMENT</span><h1 style={{fontSize:42}}>Payment status</h1><p>{message}</p><div className="actions"><a className="btn primary" href="/track">Track your order</a><a className="btn secondary" href="/">Return home</a></div></div></main>;
}

export default function PaymentCallback() {
  return (
    <Suspense fallback={<main className="section container"><div className="card order"><span className="badge">MABRIG PAYMENT</span><h1 style={{fontSize:42}}>Payment status</h1><p>Loading payment status...</p></div></main>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
