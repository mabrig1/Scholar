"use client";

import { FormEvent, useDeferredValue, useMemo, useState } from "react";
import { analyzeThesisStyle, type RewriteIntegrityAudit, type ThesisStyleReport } from "@/lib/thesis-style-audit";
import styles from "./humanizer.module.css";

type HumanizerResult = {
  rewritten: string;
  before: ThesisStyleReport;
  after: ThesisStyleReport;
  integrity: RewriteIntegrityAudit;
  integrityNotice: string;
};

const sample = `# CHAPTER TWO

## 2.1 Conceptual Framework

The examination of organizational performance has become an issue that has attracted considerable attention in recent years. It is important to note that the implementation of employee motivation programmes is generally believed to be capable of bringing about an improvement in productivity. According to Okeke (2024), motivated employees often demonstrate stronger commitment to organizational objectives. The study recorded 62.5% agreement among 240 respondents (Okeke, 2024).

However, the relationship between motivation and performance should not be treated as automatic. “Motivation produces value when institutional conditions allow employees to translate effort into results.” This distinction is central to the present study. Supporting metadata can be checked at https://doi.org/10.1234/example.1.`;

const metricLabels: Array<{ key: keyof ThesisStyleReport; label: string; digits?: number }> = [
  { key: "wordCount", label: "Words" },
  { key: "averageSentenceWords", label: "Avg. sentence", digits: 1 },
  { key: "longSentenceCount", label: "Long sentences" },
  { key: "passiveVoiceSignals", label: "Passive signals" },
  { key: "nominalizationSignals", label: "Nominalizations" },
  { key: "fleschReadingEase", label: "Reading ease", digits: 1 },
];

function metricValue(report: ThesisStyleReport, key: keyof ThesisStyleReport, digits = 0) {
  const value = report[key];
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

export default function ThesisHumanizerClient({ aiConfigured }: { aiConfigured: boolean }) {
  const [text, setText] = useState(sample);
  const [title, setTitle] = useState("My Thesis");
  const [studentName, setStudentName] = useState("");
  const [chapter, setChapter] = useState("2");
  const [depth, setDepth] = useState("balanced");
  const [goal, setGoal] = useState("formal-natural");
  const [voiceSample, setVoiceSample] = useState("");
  const [supervisorCorrections, setSupervisorCorrections] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [result, setResult] = useState<HumanizerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredText = useDeferredValue(text);
  const sourceReport = useMemo(() => analyzeThesisStyle(deferredText), [deferredText]);

  async function uploadDocument(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    setFileNote("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/humanizer/extract", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The document could not be read.");
      setText(data.text);
      setFileNote(`${data.fileName} loaded${data.warning ? ` — ${data.warning}` : ""}`);
      setResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document could not be read.");
    } finally {
      setUploading(false);
    }
  }

  async function humanize(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/humanizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title, chapter, depth, goal, voiceSample, supervisorCorrections, extraInstructions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The thesis edit could not be completed.");
      setResult(data);
      requestAnimationFrame(() => document.getElementById("humanizer-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The thesis edit could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result.rewritten);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function exportWord() {
    if (!result) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/humanizer/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, studentName, text: result.rewritten }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Word export failed." }));
        throw new Error(data.error || "Word export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title || "thesis-chapter"}-humanized.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Word export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className="container nav">
        <a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a>
        <nav className="actions" aria-label="Research tools"><a className="btn secondary" href="/chapter-two">Review literature</a><a className="btn secondary" href="/chapter-four">Analyze data</a><a className="btn secondary" href="/formatter">Format</a></nav>
      </header>

      <section className={styles.hero}>
        <div className="container">
          <span className="badge">VOICE-PRESERVING • EVIDENCE-SAFE</span>
          <h1>Make thesis writing sound clearer, natural and genuinely yours.</h1>
          <p className="lead">Diagnose dense academic prose, guide a careful edit, compare before and after, and reject any rewrite that damages citations, numbers, headings, quotations or DOI links.</p>
          <div className={styles.guardrail}>Built for responsible academic editing—not detector evasion, fabricated evidence or disguised authorship.</div>
        </div>
      </section>

      <form className={`container ${styles.workspace}`} onSubmit={humanize}>
        <section className={styles.editorPanel}>
          <div className={styles.panelHead}><span>1</span><div><h2>Supply the chapter</h2><p>Paste text or extract it from TXT, Markdown, DOCX or a text-based PDF.</p></div></div>
          <label className={styles.upload}><input type="file" accept=".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void uploadDocument(event.target.files?.[0])} /><strong>{uploading ? "Extracting text…" : "Upload a document up to 4 MB"}</strong><small>{fileNote || "The extracted text appears below for review before editing."}</small></label>
          <div className={styles.editorToolbar}><span>{sourceReport.wordCount.toLocaleString()} words · {sourceReport.sentenceCount} sentences · {sourceReport.citationCount} citations detected</span><button type="button" onClick={() => { setText(sample); setResult(null); }}>Use sample</button></div>
          <label className={styles.textareaLabel}><span>Thesis text</span><textarea value={text} onChange={(event) => { setText(event.target.value); setResult(null); }} rows={24} maxLength={80000} required /></label>
        </section>

        <aside className={styles.optionsPanel}>
          <div className={styles.panelHead}><span>2</span><div><h2>Direct the edit</h2><p>Set the chapter, purpose and depth.</p></div></div>
          <label><span>Research title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} /></label>
          <label><span>Student/author name for Word export</span><input value={studentName} onChange={(event) => setStudentName(event.target.value)} maxLength={160} placeholder="Optional" /></label>
          <div className={styles.twoColumns}>
            <label><span>Chapter</span><select value={chapter} onChange={(event) => setChapter(event.target.value)}><option value="1">Chapter One</option><option value="2">Chapter Two</option><option value="3">Chapter Three</option><option value="4">Chapter Four</option><option value="5">Chapter Five</option></select></label>
            <label><span>Edit depth</span><select value={depth} onChange={(event) => setDepth(event.target.value)}><option value="light">Light</option><option value="balanced">Balanced</option><option value="deep">Deep restructuring</option></select></label>
          </div>
          <label><span>Primary writing goal</span><select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="formal-natural">Formal, natural academic voice</option><option value="clarity">Clarity and directness</option><option value="concise">Concise without losing evidence</option><option value="synthesis">Literature synthesis and comparison</option></select></label>
          <label><span>Your authentic voice sample</span><textarea rows={5} value={voiceSample} onChange={(event) => setVoiceSample(event.target.value)} maxLength={5000} placeholder="Paste 1–3 paragraphs you wrote and your supervisor accepted. Used for rhythm and vocabulary only." /></label>
          <label><span>Supervisor corrections</span><textarea rows={5} value={supervisorCorrections} onChange={(event) => setSupervisorCorrections(event.target.value)} maxLength={20000} placeholder="Paste corrections that the edit must respect." /></label>
          <label><span>Additional instructions</span><textarea rows={4} value={extraInstructions} onChange={(event) => setExtraInstructions(event.target.value)} maxLength={10000} placeholder="e.g. reduce repetition; strengthen comparison; retain discipline-specific terminology" /></label>
          <div className={aiConfigured ? styles.ready : styles.notReady}><strong>{aiConfigured ? "AI editor connected" : "AI editor not configured"}</strong><span>{aiConfigured ? "The integrity audit still has final authority." : "The diagnostic works now; configure an approved AI provider to enable rewriting."}</span></div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button className={styles.submit} type="submit" disabled={loading || !aiConfigured || text.length < 120}>{loading ? "Editing and auditing evidence…" : "Humanize with integrity protection →"}</button>
        </aside>
      </form>

      <section className={`container ${styles.auditSection}`}>
        <div className={styles.sectionHead}><div><span className="badge">LIVE WRITING DIAGNOSTIC</span><h2>What the current draft is doing</h2></div><p>Signals guide revision; they are not proof of writing quality or AI authorship.</p></div>
        <div className={styles.metrics}>{metricLabels.map((metric) => <article key={metric.key}><span>{metric.label}</span><strong>{metricValue(sourceReport, metric.key, metric.digits)}</strong></article>)}</div>
        <div className={styles.issueGrid}>{sourceReport.issues.length ? sourceReport.issues.map((issue) => <details key={issue.id}><summary><strong>{issue.label}</strong><span>{issue.count}</span></summary><p>{issue.guidance}</p>{issue.examples.map((example) => <small key={example}>{example}</small>)}</details>) : <div className={styles.cleanState}>No major deterministic style signals were detected. A human review is still required.</div>}</div>
      </section>

      {result ? <section className={`container ${styles.resultSection}`} id="humanizer-result">
        <div className={styles.resultTop}><div><span className="badge">EDIT PASSED THE FIREWALLS</span><h2>Review every change before accepting it</h2><p>{result.integrityNotice}</p></div><div className={styles.resultActions}><button type="button" onClick={() => void copyResult()}>{copied ? "Copied ✓" : "Copy edited text"}</button><button type="button" onClick={() => { setText(result.rewritten); setResult(null); }}>Use as next draft</button><button className={styles.export} type="button" disabled={exporting} onClick={() => void exportWord()}>{exporting ? "Building Word…" : "Export Word"}</button></div></div>
        <div className={styles.firewalls}>{[
          ["Citations", result.integrity.citationsPreserved], ["Numbers", result.integrity.numbersPreserved], ["Headings", result.integrity.headingsPreserved], ["Quotations", result.integrity.quotationsPreserved], ["DOIs", result.integrity.doisPreserved],
        ].map(([label, passed]) => <span key={String(label)} className={passed ? styles.pass : styles.fail}>{passed ? "✓" : "!"} {label}</span>)}</div>
        <div className={styles.changeMetrics}><span><strong>{result.integrity.wordCountChangePercent.toFixed(1)}%</strong> word-count change</span><span><strong>{result.integrity.vocabularyRetentionPercent.toFixed(1)}%</strong> source-vocabulary retention</span></div>
        <div className={styles.comparison}><article><h3>Original</h3><pre>{text}</pre></article><article><h3>Edited</h3><pre>{result.rewritten}</pre></article></div>
        <div className={styles.afterAudit}><h2>Before and after diagnostics</h2><div className={styles.tableWrap}><table><thead><tr><th>Signal</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>{metricLabels.map((metric) => { const before = Number(result.before[metric.key]); const after = Number(result.after[metric.key]); return <tr key={metric.key}><td>{metric.label}</td><td>{before.toFixed(metric.digits || 0)}</td><td>{after.toFixed(metric.digits || 0)}</td><td>{(after - before).toFixed(metric.digits || 0)}</td></tr>; })}</tbody></table></div></div>
      </section> : null}

      <section className={`container ${styles.boundary}`}><h2>Responsible-use boundary</h2><p>The humanizer improves language and organization in text you are authorized to edit. It does not certify originality, guarantee detector outcomes, replace plagiarism checks, or remove the researcher’s duty to verify evidence and disclose AI assistance where required.</p></section>
    </main>
  );
}
