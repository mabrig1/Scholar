"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./citation-auditor.module.css";

type Item = {
  lineNumber: number;
  reference: string;
  doi: string | null;
  status: "verified" | "warning" | "failed" | "unverified";
  crossrefFound: boolean;
  openAlexFound: boolean;
  title: string | null;
  publisher: string | null;
  publishedYear: number | null;
  isRetracted: boolean | null;
  citedByCount: number | null;
  issues: string[];
};

type Result = {
  auditedAt: string;
  totalReferences: number;
  doiReferences: number;
  verifiedDois: number;
  failedDois: number;
  duplicateDois: string[];
  possibleMalformedDois: string[];
  retractionFlags: number;
  score: number;
  grade: "strong" | "good" | "needs-work" | "poor";
  items: Item[];
  priorityFixes: string[];
  notice: string;
};

function badge(status: Item["status"]) {
  if (status === "verified") return "VERIFIED";
  if (status === "warning") return "REVIEW";
  if (status === "failed") return "FIX";
  return "MANUAL";
}

export default function CitationAuditorClient() {
  const [references, setReferences] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const report = useMemo(() => {
    if (!result) return "";
    return [
      "MABRIG RESEARCHER PRO — CITATION & DOI INTEGRITY AUDIT",
      `Audit date: ${new Date(result.auditedAt).toLocaleString()}`,
      `Integrity score: ${result.score}/100 (${result.grade})`,
      `References checked: ${result.totalReferences}`,
      `DOI references: ${result.doiReferences}`,
      `Verified DOI records: ${result.verifiedDois}`,
      `Failed DOI records: ${result.failedDois}`,
      `Retraction flags: ${result.retractionFlags}`,
      "",
      "PRIORITY FIXES",
      ...result.priorityFixes.map((item, index) => `${index + 1}. ${item}`),
      "",
      "REFERENCE-BY-REFERENCE RESULTS",
      ...result.items.map((item) => `[${badge(item.status)}] #${item.lineNumber}${item.doi ? ` DOI ${item.doi}` : ""}\n${item.reference}\n${item.title ? `Resolved title: ${item.title}\n` : ""}${item.issues.length ? item.issues.map((issue) => `- ${issue}`).join("\n") : "- No automated DOI-integrity issue detected."}`),
      "",
      "LIMIT",
      result.notice,
    ].join("\n");
  }, [result]);

  async function runAudit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/citation-auditor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Citation audit failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Citation audit failed.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citation-doi-integrity-audit.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (report) await navigator.clipboard.writeText(report);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>CITATION & DOI INTEGRITY AUDITOR</div>
          <h1>Catch broken, duplicate and high-risk references before submission.</h1>
          <p>Paste the manuscript reference list. Researcher Pro verifies detected DOIs against Crossref and OpenAlex, flags duplicates, failed DOI records and OpenAlex retraction signals, then produces a repair map.</p>
        </div>
        <div className={styles.heroBadge}>Premium pre-submission gate</div>
      </section>

      <div className={styles.grid}>
        <form className={styles.card} onSubmit={runAudit}>
          <label className={styles.field}>
            <span>Reference list</span>
            <textarea required value={references} onChange={(e) => setReferences(e.target.value)} placeholder="Paste one reference per line. Up to 60 references are audited per run." />
          </label>
          <div className={styles.info}>The auditor does not assume every legitimate source has a DOI. References without detected DOIs are marked for manual bibliographic checking rather than automatically rejected.</div>
          <button className={styles.primary} disabled={loading}>{loading ? "Verifying DOI records…" : "Run citation integrity audit"}</button>
          {error && <div className={styles.error}>{error}</div>}
        </form>

        <section className={styles.card}>
          {!result ? <div className={styles.empty}><strong>Integrity results appear here</strong><span>Use this before journal formatting and final submission.</span></div> : <>
            <div className={styles.scoreRow}>
              <div className={`${styles.score} ${styles[`grade_${result.grade}`]}`}>{result.score}</div>
              <div><div className={styles.eyebrow}>REFERENCE INTEGRITY / 100</div><h2>{result.grade.replace("-", " ")}</h2><p>{result.verifiedDois}/{result.doiReferences} DOI-bearing references resolved.</p></div>
            </div>
            <div className={styles.stats}>
              <div><span>Total refs</span><strong>{result.totalReferences}</strong></div>
              <div><span>Failed DOI</span><strong>{result.failedDois}</strong></div>
              <div><span>Duplicates</span><strong>{result.duplicateDois.length}</strong></div>
              <div><span>Retraction flags</span><strong>{result.retractionFlags}</strong></div>
            </div>
            <div className={styles.actions}><button onClick={copy}>Copy report</button><button onClick={download}>Download report</button></div>
            <h3>Priority repair map</h3>
            <ol className={styles.fixList}>{result.priorityFixes.map((fix) => <li key={fix}>{fix}</li>)}</ol>
          </>}
        </section>
      </div>

      {result && <section className={styles.results}>
        <div className={styles.eyebrow}>REFERENCE-BY-REFERENCE EVIDENCE</div>
        {result.items.map((item) => <article className={`${styles.item} ${styles[`item_${item.status}`]}`} key={`${item.lineNumber}-${item.doi || "none"}`}>
          <div className={styles.itemHead}><span>{badge(item.status)}</span><strong>Reference {item.lineNumber}</strong><b>{item.doi || "No DOI detected"}</b></div>
          <p>{item.reference}</p>
          {item.title && <div className={styles.resolved}><strong>Resolved:</strong> {item.title}{item.publishedYear ? ` (${item.publishedYear})` : ""}{item.publisher ? ` · ${item.publisher}` : ""}</div>}
          {item.citedByCount !== null && <small>OpenAlex cited-by count: {item.citedByCount}</small>}
          {item.issues.length > 0 && <ul>{item.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
        </article>)}
        <div className={styles.notice}>{result.notice}</div>
      </section>}
    </main>
  );
}
