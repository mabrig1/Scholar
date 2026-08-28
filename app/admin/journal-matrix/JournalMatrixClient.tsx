"use client";

import { FormEvent, useState } from "react";
import styles from "./journal-matrix.module.css";

type Row = {
  requestedName: string;
  resolved: boolean;
  warning?: string;
  evidenceScore?: number;
  journal?: {
    id: string;
    name: string;
    issn: string[];
    publisher?: string | null;
    country?: string | null;
    isOpenAccess: boolean;
    isInDoaj: boolean;
    apcUsd?: number | null;
    hIndex?: number | null;
    twoYearMeanCitedness?: number | null;
    feeStatus: string;
    impactSignal: string;
  };
  topic?: { relatedWorks: number; sampledTitles: string[] };
  crossref?: { title?: string | null; publisher?: string | null; issn?: string[] } | null;
};

type Result = {
  rows: Row[];
  aiAnalysis: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  generatedAt: string;
  notice: string;
};

export default function JournalMatrixClient() {
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [abstract, setAbstract] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const candidates = candidateText.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const response = await fetch("/api/admin/journal-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, field, abstract, candidates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Journal comparison failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  const report = result ? [
    "MABRIG RESEARCHER PRO — JOURNAL TARGET DECISION MATRIX",
    `Manuscript: ${title}`,
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    "",
    "CANDIDATE EVIDENCE",
    ...result.rows.map((row) => row.resolved && row.journal
      ? `${row.journal.name} — evidence ${Math.round(row.evidenceScore || 0)}/100 | related-work sample ${row.topic?.relatedWorks || 0}/10 | OA ${row.journal.isOpenAccess ? "yes" : "no/unknown"} | DOAJ signal ${row.journal.isInDoaj ? "yes" : "no"} | APC ${row.journal.apcUsd ?? "unknown"} | h-index ${row.journal.hIndex ?? "unknown"} | 2yr mean citedness ${row.journal.twoYearMeanCitedness ?? "unknown"}`
      : `${row.requestedName} — unresolved: ${row.warning || "No record"}`),
    "",
    "AI-ASSISTED STRATEGY",
    result.aiAnalysis || "No AI provider returned an analysis. Use the evidence table and manually verify official journal policies.",
    "",
    result.notice,
  ].join("\n") : "";

  async function copy() {
    if (report) await navigator.clipboard.writeText(report);
  }

  function download() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-target-decision-matrix.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>JOURNAL TARGET DECISION MATRIX</div>
          <h1>Turn a journal shortlist into an evidence-backed submission sequence.</h1>
          <p>Compare named journals using live scholarly registry records, OA/DOAJ/APC signals, transparent citation indicators and manuscript-topic overlap. Researcher Pro then builds a conservative first-choice and backup strategy.</p>
        </div>
        <div className={styles.heroBadge}>2–6 journals per comparison</div>
      </section>

      <div className={styles.grid}>
        <form className={styles.card} onSubmit={run}>
          <label><span>Manuscript title *</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full article title" /></label>
          <label><span>Field / discipline</span><input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Public Administration" /></label>
          <label><span>Abstract *</span><textarea required value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Paste the manuscript abstract (minimum 80 characters)" /></label>
          <label><span>Journal candidates — one per line *</span><textarea className={styles.candidates} required value={candidateText} onChange={(e) => setCandidateText(e.target.value)} placeholder={"Journal A\nJournal B\nJournal C"} /></label>
          <button className={styles.primary} disabled={loading}>{loading ? "Comparing live journal evidence…" : "Build journal decision matrix"}</button>
          {error && <div className={styles.error}>{error}</div>}
        </form>

        <section className={styles.card}>
          {!result ? <div className={styles.empty}><strong>Decision matrix appears here</strong><span>Use this after Researcher Pro creates a shortlist, or when a client already has journal options.</span></div> : <>
            <div className={styles.resultHead}>
              <div><div className={styles.eyebrow}>EVIDENCE COMPARISON</div><h2>{result.rows.length} journal candidates</h2><p>{result.aiProvider ? `${result.aiProvider} / ${result.aiModel}` : "Registry evidence only"}</p></div>
              <div className={styles.actions}><button onClick={copy}>Copy</button><button onClick={download}>Download</button></div>
            </div>
            <div className={styles.rows}>
              {result.rows.map((row) => row.resolved && row.journal ? <article className={styles.journal} key={row.requestedName}>
                <div className={styles.journalHead}><div><strong>{row.journal.name}</strong><span>{row.journal.publisher || "Publisher not returned"} · {row.journal.country || "Country unknown"}</span></div><b>{Math.round(row.evidenceScore || 0)}</b></div>
                <div className={styles.metrics}>
                  <span>Topic sample <strong>{row.topic?.relatedWorks || 0}/10</strong></span>
                  <span>OA <strong>{row.journal.isOpenAccess ? "Yes" : "No/unknown"}</strong></span>
                  <span>DOAJ <strong>{row.journal.isInDoaj ? "Signal" : "No signal"}</strong></span>
                  <span>APC <strong>{row.journal.apcUsd === 0 ? "$0 listed" : row.journal.apcUsd ? `$${row.journal.apcUsd}` : "Unknown"}</strong></span>
                  <span>h-index <strong>{row.journal.hIndex ?? "—"}</strong></span>
                  <span>2yr citedness <strong>{row.journal.twoYearMeanCitedness ?? "—"}</strong></span>
                </div>
                {row.topic?.sampledTitles?.length ? <details><summary>Related article sample</summary><ul>{row.topic.sampledTitles.map((sample) => <li key={sample}>{sample}</li>)}</ul></details> : null}
              </article> : <article className={`${styles.journal} ${styles.unresolved}`} key={row.requestedName}><strong>{row.requestedName}</strong><p>{row.warning}</p></article>)}
            </div>
          </>}
        </section>
      </div>

      {result && <section className={styles.analysis}>
        <div className={styles.eyebrow}>AI-ASSISTED JOURNAL STRATEGY</div>
        <pre>{result.aiAnalysis || "No AI provider returned an analysis. Use the evidence matrix and verify current journal scope, fees, indexing and author guidelines manually."}</pre>
        <div className={styles.notice}>{result.notice}</div>
      </section>}
    </main>
  );
}
