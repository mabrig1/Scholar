"use client";

import { useEffect, useMemo, useState } from "react";
import {
  emptyResearchWorkspace,
  normalizeResearchWorkspace,
  RESEARCH_WORKSPACE_STORAGE_KEY,
  researchWorkspaceProgress,
  type ResearchWorkspace,
} from "@/lib/research-workspace";

export default function WorkspaceClient() {
  const [workspace, setWorkspace] = useState<ResearchWorkspace>(emptyResearchWorkspace);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const progress = useMemo(() => researchWorkspaceProgress(workspace), [workspace]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RESEARCH_WORKSPACE_STORAGE_KEY);
      if (stored) setWorkspace(normalizeResearchWorkspace(JSON.parse(stored)));
    } catch {
      window.localStorage.removeItem(RESEARCH_WORKSPACE_STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  function setField(field: keyof ResearchWorkspace, value: string) {
    setWorkspace((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function saveWorkspace() {
    const next = { ...workspace, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(RESEARCH_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
    setSaved(true);
  }

  function clearWorkspace() {
    if (!window.confirm("Clear this manuscript workspace from this device?")) return;
    window.localStorage.removeItem(RESEARCH_WORKSPACE_STORAGE_KEY);
    setWorkspace({ ...emptyResearchWorkspace });
    setSaved(false);
  }

  function continueTo(path: string) {
    saveWorkspace();
    const query = workspace.title ? `?title=${encodeURIComponent(workspace.title)}` : "";
    window.location.href = `${path}${query}`;
  }

  if (!ready) return <main className="workspace-shell"><div className="container">Loading workspace…</div></main>;

  return (
    <main className="workspace-shell">
      <header className="container nav">
        <a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a>
        <div className="actions"><a className="btn secondary" href="/pricing">Pricing</a><a className="btn secondary" href="/track">Track work</a></div>
      </header>

      <section className="workspace-hero">
        <div className="container">
          <span className="badge">PRIVATE ON THIS DEVICE</span>
          <h1>Your manuscript command centre.</h1>
          <p className="lead">Enter the research details once. Researcher Pro carries them into formatting, publishing intelligence and professional assistance.</p>
        </div>
      </section>

      <section className="section container workspace-layout">
        <article className="card workspace-form-card">
          <div className="workspace-card-heading"><div><span className="badge">MANUSCRIPT PROFILE</span><h2>Describe the work</h2></div><button className="workspace-clear" type="button" onClick={clearWorkspace}>Clear</button></div>
          <div className="form-grid">
            <label className="field full"><span>Manuscript title</span><input value={workspace.title} onChange={(e) => setField("title", e.target.value)} placeholder="Complete working title" /></label>
            <label className="field"><span>Field / discipline</span><input value={workspace.field} onChange={(e) => setField("field", e.target.value)} placeholder="e.g. Public Administration" /></label>
            <label className="field"><span>Institution</span><input value={workspace.institution} onChange={(e) => setField("institution", e.target.value)} placeholder="University or organisation" /></label>
            <label className="field"><span>Article type</span><select value={workspace.articleType} onChange={(e) => setField("articleType", e.target.value)}><option>Original research article</option><option>Systematic review</option><option>Literature review</option><option>Case study</option><option>Theoretical article</option><option>Thesis / dissertation</option></select></label>
            <label className="field"><span>Current stage</span><select value={workspace.studyStage} onChange={(e) => setField("studyStage", e.target.value)}><option value="idea">Idea / proposal</option><option value="draft">Early draft</option><option value="complete">Complete manuscript</option><option value="revising">Revising after review</option></select></label>
            <label className="field"><span>Publishing target</span><select value={workspace.target} onChange={(e) => setField("target", e.target.value)}><option value="scopus">Scopus required</option><option value="verified">Verified journal, Scopus optional</option><option value="either">Best verified or Scopus route</option></select></label>
            <label className="field"><span>Maximum publication cost</span><select value={workspace.budget} onChange={(e) => setField("budget", e.target.value)}><option value="zero">Zero-fee only</option><option value="low">Low cost / waiver route</option><option value="moderate">Moderate funded budget</option><option value="flexible">Fit first</option></select></label>
            <label className="field full"><span>Keywords</span><input value={workspace.keywords} onChange={(e) => setField("keywords", e.target.value)} placeholder="3–6 keywords, separated by commas" /></label>
            <label className="field full"><span>Abstract or project summary</span><textarea rows={10} value={workspace.abstract} onChange={(e) => setField("abstract", e.target.value)} placeholder="Include the problem, objective, method, principal findings and conclusion where available." /></label>
          </div>
          <div className="workspace-save-row"><button className="btn primary" type="button" onClick={saveWorkspace}>{saved ? "Saved on this device ✓" : "Save manuscript workspace"}</button><small>No account is required. This profile stays in this browser until you clear it.</small></div>
        </article>

        <aside className="workspace-side">
          <article className="card workspace-progress-card">
            <span className="badge">READINESS PROFILE</span>
            <div className="workspace-progress-number"><strong>{progress.percent}</strong><span>%</span></div>
            <div className="workspace-progress-track"><i style={{ width: `${progress.percent}%` }} /></div>
            <div className="workspace-checks">{progress.checks.map((check) => <span className={check.complete ? "complete" : ""} key={check.label}>{check.complete ? "✓" : "○"} {check.label}</span>)}</div>
          </article>
          <article className="card workspace-next-card">
            <span className="badge">CONTINUE</span>
            <h2>Choose the next action</h2>
            <button type="button" onClick={() => continueTo("/formatter")}><strong>Format with DocForge</strong><small>Create a structured Word document.</small></button>
            <button type="button" onClick={() => continueTo("/publishing-agent")}><strong>Build a publishing pathway</strong><small>Prefill the journal-matching agent.</small></button>
            <button type="button" onClick={() => continueTo("/academic-printing/order")}><strong>Request human assistance</strong><small>Submit the work and special instructions.</small></button>
          </article>
        </aside>
      </section>
    </main>
  );
}
