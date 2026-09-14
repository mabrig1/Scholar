"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  normalizeResearchWorkspace,
  RESEARCH_WORKSPACE_STORAGE_KEY,
} from "@/lib/research-workspace";
import styles from "./research-agent.module.css";

type Evidence = {
  doi: string;
  title: string;
  year: number;
  journal: string;
  citationCount: number;
  abstract: string;
  verification: string;
  retracted: boolean;
  evidenceScore: number;
  evidenceBand: "strong" | "useful" | "caution";
  scoreReasons: string[];
};

type MissionStep = {
  order: number;
  agentId: string;
  title: string;
  goal: string;
  output: string;
  route?: string;
};

type Agent = {
  id: string;
  name: string;
  role: string;
  capability: string;
  reviewGate: string;
};

type Trace = {
  agent: string;
  action: string;
  status: "completed" | "skipped";
  detail: string;
  durationMs: number;
};

type MissionResult = {
  missionId: string;
  generatedAt: string;
  agents: Agent[];
  plan: MissionStep[];
  evidence: Evidence[];
  synthesis: string;
  critic: string | null;
  groundingAudit: {
    citedSourceIds: string[];
    unknownSourceIds: string[];
    citationCoveragePercent: number;
    warnings: string[];
  };
  ai: {
    enabled: boolean;
    provider: string | null;
    model: string | null;
    deepCriticEnabled: boolean;
  };
  trace: Trace[];
  handoffs: Array<{ label: string; route: string }>;
};

const currentYear = new Date().getFullYear();

export default function ResearchAgentClient() {
  const [form, setForm] = useState({
    topic: "",
    researchQuestion: "",
    objectives: "",
    field: "",
    keywords: "",
    missionType: "literature-review",
    depth: "deep",
    fromYear: String(currentYear - 5),
    toYear: String(currentYear),
    maxSources: "12",
  });
  const [result, setResult] = useState<MissionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RESEARCH_WORKSPACE_STORAGE_KEY);
      if (!raw) return;
      const workspace = normalizeResearchWorkspace(JSON.parse(raw));
      setForm((current) => ({
        ...current,
        topic: workspace.title || current.topic,
        researchQuestion: workspace.abstract ? current.researchQuestion : current.researchQuestion,
        field: workspace.field || current.field,
        keywords: workspace.keywords || current.keywords,
        missionType: workspace.articleType.toLowerCase().includes("thesis") ? "thesis" : current.missionType,
      }));
    } catch {
      // A malformed local workspace should never block a fresh mission.
    }
  }, []);

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function runMission(event: FormEvent) {
    event.preventDefault();
    setError("");
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/research/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fromYear: Number(form.fromYear),
          toYear: Number(form.toYear),
          maxSources: Number(form.maxSources),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to run the research mission.");
      setResult(data);
    } catch (missionError) {
      setError(missionError instanceof Error ? missionError.message : "Unable to run the research mission.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a>
        <div className={styles.navActions}>
          <a href="/workspace">Workspace</a>
          <a href="/chapter-two">Literature Review</a>
          <a href="/publishing-agent">Publish</a>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>AGENTIC RESEARCH OS</span>
          <h1>Give Scholar a research mission—not a pile of disconnected prompts.</h1>
          <p>
            The mission planner coordinates specialist agents for literature discovery, evidence verification,
            grounded synthesis, critique, methods, integrity and publication handoffs. Every retrieved paper stays
            traceable to a DOI.
          </p>
        </div>
        <aside className={styles.heroCard}>
          <strong>Evidence-first orchestration</strong>
          <span>Crossref discovery</span>
          <span>OpenAlex verification</span>
          <span>Evidence scoring</span>
          <span>Grounded [S#] synthesis</span>
          <span>Second-pass critique in Deep mode</span>
        </aside>
      </section>

      <section className={styles.grid}>
        <form className={styles.formCard} onSubmit={runMission}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>MISSION BRIEF</span>
            <h2>What should the research team solve?</h2>
          </div>

          <label className={styles.full}>
            <span>Topic or working title</span>
            <input value={form.topic} onChange={(event) => update("topic", event.target.value)} placeholder="e.g. Digital public services and citizen trust in Nigeria" required />
          </label>

          <label className={styles.full}>
            <span>Research question</span>
            <textarea rows={3} value={form.researchQuestion} onChange={(event) => update("researchQuestion", event.target.value)} placeholder="What exactly should the evidence help answer?" />
          </label>

          <label className={styles.full}>
            <span>Objectives</span>
            <textarea rows={4} value={form.objectives} onChange={(event) => update("objectives", event.target.value)} placeholder="One objective per line, or paste your study objectives." />
          </label>

          <div className={styles.twoCol}>
            <label>
              <span>Field</span>
              <input value={form.field} onChange={(event) => update("field", event.target.value)} placeholder="Public Administration" />
            </label>
            <label>
              <span>Keywords</span>
              <input value={form.keywords} onChange={(event) => update("keywords", event.target.value)} placeholder="e-governance, trust, service delivery" />
            </label>
          </div>

          <div className={styles.twoCol}>
            <label>
              <span>Mission type</span>
              <select value={form.missionType} onChange={(event) => update("missionType", event.target.value)}>
                <option value="literature-review">Literature review</option>
                <option value="thesis">Thesis / dissertation</option>
                <option value="publication">Publication readiness</option>
                <option value="grant">Grant evidence brief</option>
                <option value="general">General research</option>
              </select>
            </label>
            <label>
              <span>Agent depth</span>
              <select value={form.depth} onChange={(event) => update("depth", event.target.value)}>
                <option value="deep">Deep — synthesis + critic</option>
                <option value="rapid">Rapid — synthesis only</option>
              </select>
            </label>
          </div>

          <div className={styles.threeCol}>
            <label>
              <span>From year</span>
              <input type="number" min="1900" max={currentYear} value={form.fromYear} onChange={(event) => update("fromYear", event.target.value)} />
            </label>
            <label>
              <span>To year</span>
              <input type="number" min="1900" max={currentYear} value={form.toYear} onChange={(event) => update("toYear", event.target.value)} />
            </label>
            <label>
              <span>Evidence set</span>
              <select value={form.maxSources} onChange={(event) => update("maxSources", event.target.value)}>
                <option value="8">8 sources</option>
                <option value="12">12 sources</option>
                <option value="16">16 sources</option>
                <option value="20">20 sources</option>
              </select>
            </label>
          </div>

          <button className={styles.runButton} type="submit" disabled={running}>
            {running ? "Agents are executing the mission…" : "Run Research Mission"}
          </button>
          <p className={styles.disclaimer}>
            Scholar retrieves registry-backed evidence and assists with synthesis. Full-text review and researcher judgment remain required.
          </p>
          {error && <div className={styles.error}>{error}</div>}
        </form>

        <aside className={styles.agentPanel}>
          <span className={styles.eyebrow}>SPECIALIST TEAM</span>
          <h2>Eight agents, one auditable workflow</h2>
          {(result?.agents || [
            { id: "planner", name: "Mission Planner", role: "Plans the workflow.", capability: "", reviewGate: "" },
            { id: "scout", name: "Literature Scout", role: "Finds DOI-backed literature.", capability: "", reviewGate: "" },
            { id: "auditor", name: "Evidence Auditor", role: "Ranks evidence and flags risks.", capability: "", reviewGate: "" },
            { id: "synthesizer", name: "Synthesis Agent", role: "Builds a grounded brief.", capability: "", reviewGate: "" },
            { id: "critic", name: "Grounding Critic", role: "Challenges unsupported claims.", capability: "", reviewGate: "" },
            { id: "methods", name: "Methods & Statistics", role: "Routes empirical analysis.", capability: "", reviewGate: "" },
            { id: "integrity", name: "Integrity Agent", role: "Protects the research artifact.", capability: "", reviewGate: "" },
            { id: "publisher", name: "Publication Strategist", role: "Builds the submission path.", capability: "", reviewGate: "" },
          ]).map((agent) => (
            <article key={agent.id} className={styles.agentCard}>
              <strong>{agent.name}</strong>
              <p>{agent.role}</p>
              {agent.capability && <small>{agent.capability}</small>}
            </article>
          ))}
        </aside>
      </section>

      {result && (
        <section className={styles.results}>
          <div className={styles.resultHeader}>
            <div>
              <span className={styles.eyebrow}>MISSION COMPLETE</span>
              <h2>Research mission #{result.missionId.slice(0, 8)}</h2>
              <p>{result.evidence.length} evidence records retrieved • {result.ai.enabled ? `AI: ${result.ai.provider}/${result.ai.model}` : "Deterministic synthesis fallback"}</p>
            </div>
            <div className={styles.coverage}>
              <strong>{result.groundingAudit.citationCoveragePercent}%</strong>
              <span>citation-token coverage</span>
            </div>
          </div>

          <div className={styles.resultGrid}>
            <article className={styles.resultCard}>
              <span className={styles.eyebrow}>AGENT PLAN</span>
              <div className={styles.timeline}>
                {result.plan.map((step) => (
                  <div key={step.order}>
                    <span>{step.order}</span>
                    <section>
                      <strong>{step.title}</strong>
                      <p>{step.goal}</p>
                      <small>Output: {step.output}</small>
                      {step.route && <a href={step.route}>Open handoff →</a>}
                    </section>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.resultCard}>
              <span className={styles.eyebrow}>EXECUTION TRACE</span>
              <div className={styles.trace}>
                {result.trace.map((item, index) => (
                  <div key={`${item.agent}-${index}`}>
                    <strong>{item.agent}</strong>
                    <p>{item.action}</p>
                    <small>{item.detail} • {item.durationMs} ms</small>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className={styles.resultCard}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>EVIDENCE MAP</span>
              <h2>Ranked, inspectable sources</h2>
            </div>
            <div className={styles.evidenceGrid}>
              {result.evidence.map((item, index) => (
                <article key={item.doi} className={styles.evidenceCard}>
                  <div className={styles.evidenceTop}>
                    <span className={`${styles.band} ${styles[item.evidenceBand]}`}>{item.evidenceBand}</span>
                    <strong>{item.evidenceScore}/100</strong>
                  </div>
                  <small>[S{index + 1}] • {item.year} • {item.verification}</small>
                  <h3>{item.title}</h3>
                  <p>{item.journal}</p>
                  <p className={styles.abstract}>{item.abstract || "Abstract unavailable. Inspect the full paper before drawing conclusions."}</p>
                  <div className={styles.reasonList}>
                    {item.scoreReasons.slice(0, 4).map((reason) => <span key={reason}>• {reason}</span>)}
                  </div>
                  <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">Open DOI record →</a>
                </article>
              ))}
            </div>
          </article>

          <div className={styles.resultGrid}>
            <article className={styles.resultCard}>
              <span className={styles.eyebrow}>GROUNDED SYNTHESIS</span>
              <pre className={styles.prose}>{result.synthesis}</pre>
            </article>
            <article className={styles.resultCard}>
              <span className={styles.eyebrow}>GROUNDING CRITIC</span>
              {result.critic ? <pre className={styles.prose}>{result.critic}</pre> : <p>Rapid mode completed a structural citation audit without a second AI critique.</p>}
              <div className={styles.warningBox}>
                {result.groundingAudit.warnings.map((warning) => <span key={warning}>• {warning}</span>)}
              </div>
            </article>
          </div>

          <article className={styles.handoffCard}>
            <div>
              <span className={styles.eyebrow}>NEXT ACTIONS</span>
              <h2>Carry the mission into Scholar’s specialist workspaces.</h2>
            </div>
            <div className={styles.handoffs}>
              {result.handoffs.map((handoff) => <a key={handoff.route} href={handoff.route}>{handoff.label} →</a>)}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
