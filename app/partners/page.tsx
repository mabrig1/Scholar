"use client";

import { useMemo, useState } from "react";

const SITE_URL = "https://academic.mabrigkorie.org";

export default function PartnersPage() {
  const [code, setCode] = useState("MABRIG001");
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(() => {
    const clean = code.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "MABRIG001";
    return `${SITE_URL}/?ref=${encodeURIComponent(clean)}`;
  }, [code]);

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: "Mabrig Researcher Pro", text: "Use my Mabrig Researcher Pro referral link:", url: referralLink });
    } else {
      await copyLink();
    }
  }

  return <main className="section"><div className="container" style={{maxWidth:800}}>
    <a className="btn secondary" href="/">← Back to Academic Assistance</a>
    <div className="card" style={{marginTop:18}}>
      <span className="badge">Mabrig Academic Partners Network</span>
      <h1 style={{fontSize:"clamp(34px,6vw,58px)"}}>Create Your Referral Link</h1>
      <p className="lead">Give students your personal referral link. When an eligible customer opens the link and places an order, the referral code is carried into the order for attribution.</p>

      <label className="field" style={{marginTop:20}}><span>Partner / Referral Code</span><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MABRIG001" autoCapitalize="characters" /></label>

      <div className="notice" style={{marginTop:16,wordBreak:"break-all"}}>
        <strong>Your referral link</strong><br />
        <a href={referralLink} style={{color:"var(--green)",fontWeight:700}}>{referralLink}</a>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={copyLink}>{copied ? "✓ Link Copied" : "Copy Referral Link"}</button>
        <button className="btn secondary" onClick={shareLink}>Share Link</button>
        <a className="btn secondary" href={referralLink}>Open Link</a>
      </div>

      <div className="card" style={{marginTop:24,background:"#f5f8f6"}}>
        <h3>How it works</h3>
        <p><strong>1.</strong> Give your referral link to a student.</p>
        <p><strong>2.</strong> The student opens the link and the referral code is remembered during the session.</p>
        <p><strong>3.</strong> The student places an order through the official platform.</p>
        <p><strong>4.</strong> The order stores the referral code for eligible commission attribution.</p>
        <p style={{marginBottom:0}}><strong>5.</strong> Commissions are payable only on eligible, confirmed and completed orders under the partner programme terms.</p>
      </div>

      <div className="notice" style={{marginTop:16}}>
        <strong>Important:</strong> Use only the referral code assigned to you by the Mabrig Academic Partners programme. Do not impersonate another partner or create misleading referral claims.
      </div>
    </div>
  </div></main>;
}
