"use client";

import { FormEvent, useState } from "react";
import styles from "./visibility-pack.module.css";

type Result = {
  pack: string;
  aiProvider: string | null;
  aiModel: string | null;
  generatedAt: string;
  notice: string;
  metadata: Record<string, string>;
};

const blank = {
  clientName: "",
  affiliation: "",
  orcid: "",
  title: "",
  journal: "",
  doi: "",
  articleUrl: "",
  keywords: "",
  abstract: "",
};

export default function VisibilityPackClient() {
  const [form, setForm] = useState(blank);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/visibility-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Visibility pack generation failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visibility pack generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (result) await navigator.clipboard.writeText(result.pack);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.pack], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.clientName || "client"}-research-visibility-pack.txt`.replace(/[^a-z0-9._-]+/gi, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>RESEARCH VISIBILITY PACK GENERATOR</div>
          <h1>Publication is not the end of the workflow. Make the research discoverable.</h1>
          <p>Build a premium post-publication package covering ORCID, repository metadata, Google Scholar monitoring, SEO/discoverability keywords, plain-language communication and a 30-day ethical dissemination plan.</p>
        </div>
        <div className={styles.heroBadge}>Post-publication premium service</div>
      </section>

      <div className={styles.grid}>
        <form className={styles.card} onSubmit={run}>
          <div className={styles.sectionTitle}>Author identity</div>
          <div className={styles.two}>
            <label><span>Client / author *</span><input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Full scholarly name" /></label>
            <label><span>Affiliation</span><input value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} placeholder="Institution / organization" /></label>
            <label><span>ORCID</span><input value={form.orcid} onChange={(e) => setForm({ ...form, orcid: e.target.value })} placeholder="0000-0000-0000-0000" /></label>
            <label><span>Journal</span><input value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} placeholder="Published journal" /></label>
          </div>

          <div className={styles.sectionTitle}>Article record</div>
          <label><span>Article title *</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Published title" /></label>
          <div className={styles.two}>
            <label><span>DOI</span><input value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} placeholder="10.xxxx/xxxxx" /></label>
            <label><span>Article URL</span><input value={form.articleUrl} onChange={(e) => setForm({ ...form, articleUrl: e.target.value })} placeholder="https://journal.org/article/..." /></label>
          </div>
          <label><span>Existing keywords</span><input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Comma-separated keywords" /></label>
          <label><span>Abstract *</span><textarea required value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} placeholder="Paste the final abstract (minimum 80 characters)" /></label>

          <div className={styles.features}>
            <strong>Pack includes</strong>
            <span>Discoverability keyword set</span><span>Plain-language summary</span><span>Repository metadata pack</span><span>ORCID update checklist</span><span>Google Scholar monitoring plan</span><span>LinkedIn/X/WhatsApp copy</span><span>30-day dissemination calendar</span><span>Metrics to monitor</span>
          </div>

          <button className={styles.primary} disabled={loading}>{loading ? "Building visibility pack…" : "Generate premium visibility pack"}</button>
          {error && <div className={styles.error}>{error}</div>}
        </form>

        <section className={styles.card}>
          {!result ? <div className={styles.empty}><strong>Your client visibility pack appears here</strong><span>Use this after publication or immediately after acceptance when the DOI/canonical record becomes available.</span></div> : <>
            <div className={styles.resultHead}>
              <div><div className={styles.eyebrow}>CLIENT DELIVERABLE</div><h2>{form.clientName}'s Research Visibility Pack</h2><p>{result.aiProvider ? `${result.aiProvider} / ${result.aiModel}` : "Deterministic fallback"} · {new Date(result.generatedAt).toLocaleString()}</p></div>
              <div className={styles.actions}><button onClick={copy}>Copy</button><button onClick={download}>Download</button></div>
            </div>
            <pre className={styles.report}>{result.pack}</pre>
            <div className={styles.notice}>{result.notice}</div>
          </>}
        </section>
      </div>
    </main>
  );
}
