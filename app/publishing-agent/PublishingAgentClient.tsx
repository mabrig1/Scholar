"use client";

import { FormEvent, useState } from "react";
import styles from "./agent.module.css";

type Check = { label: string; passed: boolean; weight: number };
type Candidate = {
  id: string;
  name: string;
  discipline: string;
  publisher: string;
  costLabel: string;
  costNote: string;
  officialUrl: string;
  scopusUrl: string;
  matchScore: number;
  matchReasons: string[];
};
type Stage = { id: string; title: string; outcome: string; actions: string[] };
type AgentResult = {
  readiness: { score: number; level: string; checks: Check[]; abstractWords: number; keywordCount: number };
  pathway: string;
  candidates: Candidate[];
  costPlan: string[];
  stages: Stage[];
  redFlags: string[];
  evidenceSources: { label: string; url: string }[];
  aiBriefing?: string | null;
  aiEnabled: boolean;
  integrityNotice: string;
};

const blankForm = {
  title: "",
  abstract: "",
  keywords: "",
  field: "",
  articleType: "Original research article",
  budget: "zero",
  indexingGoal: "scopus",
  studyStage: "complete",
};

export default function PublishingAgentClient() {
  const [form, setForm] = useState(blankForm);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(name: keyof typeof blankForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/publishing-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The agent could not prepare your plan.");
      setResult(data);
      requestAnimationFrame(() => document.getElementById("agent-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The agent could not prepare your plan.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPlan() {
    if (!result) return;
    const content = [
      "MABRIG RESEARCHER PRO — LOW-COST PUBLISHING PLAN",
      `Manuscript: ${form.title}`,
      `Pathway: ${result.pathway}`,
      `Readiness: ${result.readiness.score}/100 — ${result.readiness.level}`,
      "",
      "READINESS CHECKS",
      ...result.readiness.checks.map((check) => `${check.passed ? "PASS" : "FIX"}: ${check.label}`),
      "",
      "JOURNAL LADDER",
      ...result.candidates.map((journal, index) => `${index + 1}. ${journal.name} (${journal.matchScore}/100)\n   ${journal.costLabel}\n   ${journal.matchReasons.join("; ")}\n   Official: ${journal.officialUrl}\n   Scopus check: ${journal.scopusUrl}`),
      "",
      "COST PLAN",
      ...result.costPlan.map((item) => `- ${item}`),
      "",
      "SUBMISSION WORKFLOW",
      ...result.stages.flatMap((stage) => [stage.title, stage.outcome, ...stage.actions.map((action) => `- ${action}`), ""]),
      "RED FLAGS",
      ...result.redFlags.map((item) => `- ${item}`),
      "",
      result.integrityNotice,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form.title || "manuscript"}-publishing-plan.txt`.replace(/[^a-z0-9._-]+/gi, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>Mabrig <strong>Researcher Pro</strong></a>
        <nav className={styles.toplinks} aria-label="Publishing tools">
          <a href="/free-journals">Verified journals</a>
          <a href="/scopus-journals">Scopus journals</a>
          <a className={styles.active} href="/publishing-agent">Publishing agent</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>KNOWLEDGE + TECHNICAL AGENTIC WORKFLOW</span>
        <h1>Turn your manuscript into a <em>submission-ready, low-cost publishing plan.</em></h1>
        <p>The agent diagnoses readiness, builds a journal ladder, protects your budget, and maps every technical step from correction to post-publication verification.</p>
        <div className={styles.agentFlow} aria-label="Agent workflow">
          <span>1 · Diagnose</span><b>→</b><span>2 · Match</span><b>→</b><span>3 · Verify</span><b>→</b><span>4 · Prepare</span><b>→</b><span>5 · Submit</span>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.formIntro}>
          <div><span className={styles.eyebrow}>START THE AGENT</span><h2>Describe the article and set your cost ceiling</h2></div>
          <p>No manuscript upload is required. Your title and abstract are enough for the first pathway; always review the output against the full paper.</p>
        </div>

        <form className={styles.form} onSubmit={runAgent}>
          <label className={styles.wide}><span>Manuscript title *</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Enter the complete academic title" required /></label>
          <label><span>Field / discipline</span><input value={form.field} onChange={(event) => setField("field", event.target.value)} placeholder="e.g. Public Administration" /></label>
          <label><span>Keywords</span><input value={form.keywords} onChange={(event) => setField("keywords", event.target.value)} placeholder="3–6 keywords, separated by commas" /></label>
          <label><span>Article type</span><select value={form.articleType} onChange={(event) => setField("articleType", event.target.value)}><option>Original research article</option><option>Systematic review</option><option>Literature review</option><option>Case study</option><option>Short communication</option><option>Theoretical article</option></select></label>
          <label><span>Current stage</span><select value={form.studyStage} onChange={(event) => setField("studyStage", event.target.value)}><option value="idea">Idea / proposal</option><option value="draft">Early draft</option><option value="complete">Complete manuscript</option><option value="revising">Revising after review</option></select></label>
          <label><span>Indexing goal</span><select value={form.indexingGoal} onChange={(event) => setField("indexingGoal", event.target.value)}><option value="scopus">Scopus required</option><option value="verified">Verified journal, Scopus optional</option><option value="either">Best verified or Scopus route</option></select></label>
          <label><span>Maximum publication cost</span><select value={form.budget} onChange={(event) => setField("budget", event.target.value)}><option value="zero">₦0 / US$0 — zero-fee only</option><option value="low">Low cost — waivers acceptable</option><option value="moderate">Moderate — funded if necessary</option><option value="flexible">Flexible — fit first</option></select></label>
          <label className={styles.wide}><span>Abstract *</span><textarea value={form.abstract} onChange={(event) => setField("abstract", event.target.value)} placeholder="Paste the abstract, including objective, methods, key findings and conclusion" minLength={120} required /></label>
          {error && <div className={`${styles.error} ${styles.wide}`}>{error}</div>}
          <div className={`${styles.submitRow} ${styles.wide}`}>
            <div><strong>Ethical publishing support</strong><span>No guaranteed acceptance, fabricated indexing or hidden fee claims.</span></div>
            <button type="submit" disabled={loading}>{loading ? "Agents are building your pathway…" : "Build my publishing pathway →"}</button>
          </div>
        </form>
      </section>

      {result && (
        <section className={styles.results} id="agent-result">
          <div className={styles.resultTop}>
            <div><span className={styles.eyebrow}>YOUR AGENTIC PUBLISHING PLAN</span><h2>{result.pathway}</h2><p>{result.integrityNotice}</p></div>
            <button type="button" onClick={downloadPlan}>Download plan</button>
          </div>

          <div className={styles.readinessPanel}>
            <div className={styles.score}><strong>{result.readiness.score}</strong><span>/100</span></div>
            <div><h3>{result.readiness.level}</h3><p>{result.readiness.abstractWords} abstract words · {result.readiness.keywordCount} keywords detected</p></div>
            <div className={styles.checks}>{result.readiness.checks.map((check) => <span className={check.passed ? styles.pass : styles.fix} key={check.label}>{check.passed ? "✓" : "!"} {check.label}</span>)}</div>
          </div>

          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>JOURNAL LADDER</span><h2>Ranked candidates for manual scope and Scopus verification</h2></div><p>Match scores are decision support, not acceptance probabilities.</p></div>
          <div className={styles.candidateGrid}>{result.candidates.map((journal, index) => (
            <article className={styles.candidate} key={journal.id}>
              <div className={styles.candidateTop}><span className={styles.rank}>#{index + 1}</span><strong>{journal.matchScore}/100 fit signal</strong></div>
              <h3>{journal.name}</h3><p>{journal.discipline} · {journal.publisher}</p>
              <span className={styles.cost}>{journal.costLabel}</span>
              <ul>{journal.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <p className={styles.costNote}>{journal.costNote}</p>
              <div className={styles.links}><a href={journal.scopusUrl} target="_blank" rel="noreferrer">Verify in Scopus ↗</a><a href={journal.officialUrl} target="_blank" rel="noreferrer">Official journal ↗</a></div>
            </article>
          ))}</div>

          <div className={styles.planGrid}>
            <div className={styles.costPanel}><span className={styles.eyebrow}>MINIMAL-COST ROUTE</span><h2>Protect the budget before submission</h2><ol>{result.costPlan.map((item) => <li key={item}>{item}</li>)}</ol></div>
            <div className={styles.redPanel}><span className={styles.eyebrow}>STOP SIGNALS</span><h2>Do not submit or pay when…</h2><ul>{result.redFlags.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>

          {result.aiBriefing && <section className={styles.aiBrief}><span className={styles.eyebrow}>AI TECHNICAL BRIEFING</span><div>{result.aiBriefing}</div></section>}

          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>COMPLETE WORKFLOW</span><h2>From manuscript diagnosis to verified publication record</h2></div></div>
          <div className={styles.stages}>{result.stages.map((stage) => <article key={stage.id}><h3>{stage.title}</h3><p>{stage.outcome}</p><ul>{stage.actions.map((action) => <li key={action}>{action}</li>)}</ul></article>)}</div>

          <div className={styles.sources}><strong>Official verification tools:</strong>{result.evidenceSources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} ↗</a>)}</div>
        </section>
      )}
    </main>
  );
}
