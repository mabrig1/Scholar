"use client";

import { FormEvent, useMemo, useState } from "react";
import { READINESS_CHECKS, calculateSubmissionReadiness } from "@/lib/submission-readiness";
import styles from "./submission-readiness.module.css";

const categoryNames: Record<string, string> = {
  manuscript: "Manuscript quality",
  ethics: "Ethics & declarations",
  references: "References & citation integrity",
  journal: "Journal evidence & fit",
  files: "Submission files & formatting",
  visibility: "Research visibility metadata",
};

type ApiResult = ReturnType<typeof calculateSubmissionReadiness> & {
  aiMemo: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  generatedAt: string;
};

export default function SubmissionReadinessClient() {
  const [clientName, setClientName] = useState("");
  const [manuscriptTitle, setManuscriptTitle] = useState("");
  const [targetJournal, setTargetJournal] = useState("");
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => calculateSubmissionReadiness(completedIds), [completedIds]);
  const categories = [...new Set(READINESS_CHECKS.map((check) => check.category))];

  function toggle(id: string) {
    setCompletedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setResult(null);
  }

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/submission-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, manuscriptTitle, targetJournal, completedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Readiness assessment failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Readiness assessment failed.");
    } finally {
      setLoading(false);
    }
  }

  const report = result ? [
    "MABRIG RESEARCHER PRO — SUBMISSION READINESS DECISION",
    `Client: ${clientName || "Not supplied"}`,
    `Manuscript: ${manuscriptTitle || "Not supplied"}`,
    `Target journal: ${targetJournal || "Not supplied"}`,
    `Decision: ${result.decision}`,
    `Readiness score: ${result.score}/100`,
    "",
    "CATEGORY SCORES",
    ...Object.entries(result.categoryScores).map(([key, value]) => `${categoryNames[key] || key}: ${value}%`),
    "",
    "CRITICAL BLOCKERS",
    ...(result.criticalFailures.length ? result.criticalFailures.map((check, i) => `${i + 1}. ${check.label}`) : ["None recorded."]),
    "",
    "AI / PUBLISHER RISK MEMO",
    result.aiMemo || "AI memo unavailable; use the deterministic checklist decision above.",
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
    a.download = `${clientName || "client"}-submission-readiness.txt`.replace(/[^a-z0-9._-]+/gi, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>SUBMISSION READINESS COMMAND CENTER</div>
          <h1>Do not submit because the manuscript “looks ready.” Prove readiness.</h1>
          <p>Run a weighted final gate across manuscript quality, ethics, references, journal evidence, submission files and post-publication visibility. Researcher Pro returns GO, CONDITIONAL GO or HOLD.</p>
        </div>
        <div className={`${styles.decision} ${styles[`decision_${preview.decision.replaceAll(" ", "_")}`]}`}>{preview.decision}<span>{preview.score}/100</span></div>
      </section>

      <form onSubmit={run}>
        <section className={styles.identity}>
          <label><span>Client / author</span><input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Author name" /></label>
          <label><span>Manuscript title</span><input value={manuscriptTitle} onChange={(e) => setManuscriptTitle(e.target.value)} placeholder="Article title" /></label>
          <label><span>Target journal</span><input value={targetJournal} onChange={(e) => setTargetJournal(e.target.value)} placeholder="Journal selected for submission" /></label>
        </section>

        <div className={styles.layout}>
          <div className={styles.checklist}>
            {categories.map((category) => {
              const checks = READINESS_CHECKS.filter((check) => check.category === category);
              const score = preview.categoryScores[category] || 0;
              return <section className={styles.category} key={category}>
                <div className={styles.categoryHead}><div><div className={styles.eyebrow}>{categoryNames[category]}</div><h2>{score}% ready</h2></div><div className={styles.bar}><span style={{ width: `${score}%` }} /></div></div>
                <div className={styles.rows}>
                  {checks.map((check) => <label className={`${styles.row} ${completedIds.includes(check.id) ? styles.rowDone : ""}`} key={check.id}>
                    <input type="checkbox" checked={completedIds.includes(check.id)} onChange={() => toggle(check.id)} />
                    <div><strong>{check.label}</strong><span>{check.critical ? "Critical gate" : "Standard gate"} · weight {check.weight}</span></div>
                  </label>)}
                </div>
              </section>;
            })}
          </div>

          <aside className={styles.summary}>
            <div className={styles.sticky}>
              <div className={styles.eyebrow}>LIVE SUBMISSION DECISION</div>
              <div className={`${styles.bigDecision} ${styles[`decision_${preview.decision.replaceAll(" ", "_")}`]}`}>{preview.decision}</div>
              <div className={styles.score}>{preview.score}<span>/100</span></div>
              <p>{preview.criticalFailures.length} critical blocker{preview.criticalFailures.length === 1 ? "" : "s"} remaining.</p>
              {preview.criticalFailures.length > 0 && <ul>{preview.criticalFailures.slice(0, 5).map((check) => <li key={check.id}>{check.label}</li>)}</ul>}
              <button className={styles.primary} disabled={loading}>{loading ? "Generating final risk memo…" : "Generate final publisher decision memo"}</button>
              {error && <div className={styles.error}>{error}</div>}
            </div>
          </aside>
        </div>
      </form>

      {result && <section className={styles.memo}>
        <div className={styles.memoHead}><div><div className={styles.eyebrow}>FINAL PUBLISHER RISK MEMO</div><h2>{result.decision} · {result.score}/100</h2><p>{result.aiProvider ? `${result.aiProvider} / ${result.aiModel}` : "Deterministic checklist only"} · {new Date(result.generatedAt).toLocaleString()}</p></div><div className={styles.actions}><button onClick={copy}>Copy</button><button onClick={download}>Download</button></div></div>
        <pre>{result.aiMemo || "No AI provider returned a memo. The deterministic decision and critical blockers remain valid."}</pre>
      </section>}
    </main>
  );
}
