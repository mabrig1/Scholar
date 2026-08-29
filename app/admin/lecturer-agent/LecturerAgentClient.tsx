"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  LECTURER_WORKFLOW_DEFINITIONS,
  type LecturerWorkflow,
  type LecturerWorkflowStep,
} from "@/lib/lecturer-agent";
import styles from "./lecturer-agent.module.css";

type Evidence = { name: string; status: "missing" | "supplied" | "verified"; note?: string };
type CaseStep = Omit<LecturerWorkflowStep, "status"> & {
  status: "planned" | "ready" | "awaiting-approval" | "approved" | "rejected" | "completed";
  decisionNote?: string;
};
type WorkflowCase = {
  _id: string;
  caseNumber: string;
  lecturerName: string;
  institution: string;
  department?: string;
  workflow: LecturerWorkflow;
  title: string;
  context?: string;
  workloadCount: number;
  currency: string;
  status: string;
  executionMode: "review-gated";
  externalExecutionEnabled: false;
  steps: CaseStep[];
  evidence: Evidence[];
  activity: Array<{ event: string; actor: string; detail?: string; at: string }>;
  updatedAt: string;
};

const initialForm = {
  lecturerName: "",
  institution: "University of Nigeria, Nsukka",
  department: "",
  workflow: "grading" as LecturerWorkflow,
  title: "",
  context: "",
  workloadCount: 0,
  currency: "NGN",
};

function humanize(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}

export default function LecturerAgentClient() {
  const [form, setForm] = useState(initialForm);
  const [suppliedEvidence, setSuppliedEvidence] = useState<string[]>([]);
  const [cases, setCases] = useState<WorkflowCase[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = cases.find((item) => item._id === selectedId) || cases[0] || null;
  const definition = LECTURER_WORKFLOW_DEFINITIONS[form.workflow];

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/lecturer-agent", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load cases.");
        setCases(data.cases || []);
        if (data.cases?.[0]?._id) setSelectedId(data.cases[0]._id);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function api(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/lecturer-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Workflow update failed.");
    return data as { case: WorkflowCase };
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api({ action: "create", ...form, suppliedEvidence });
      setCases((current) => [data.case, ...current]);
      setSelectedId(data.case._id);
      setForm((current) => ({ ...initialForm, lecturerName: current.lecturerName, institution: current.institution, department: current.department }));
      setSuppliedEvidence([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workflow creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function decide(stepId: string, decision: "approved" | "rejected") {
    if (!selected) return;
    const note = window.prompt(decision === "approved" ? "Approval note (recommended):" : "Reason for rejection:") || "";
    if (decision === "rejected" && !note.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = await api({ action: "decide", caseId: selected._id, stepId, decision, note });
      setCases((current) => current.map((item) => item._id === data.case._id ? data.case : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Approval update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function completeStep(stepId: string) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const data = await api({ action: "complete-step", caseId: selected._id, stepId });
      setCases((current) => current.map((item) => item._id === data.case._id ? data.case : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Step update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateEvidence(evidenceName: string, status: Evidence["status"]) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const data = await api({ action: "evidence", caseId: selected._id, evidenceName, status });
      setCases((current) => current.map((item) => item._id === data.case._id ? data.case : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence update failed.");
    } finally {
      setSaving(false);
    }
  }

  function changeWorkflow(workflow: LecturerWorkflow) {
    setForm((current) => ({ ...current, workflow }));
    setSuppliedEvidence([]);
  }

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div>
        <span>LECTURER AGENT HUB</span>
        <h1>Five academic workflows. One accountable command centre.</h1>
        <p>Designed for Nigerian lecturers managing extreme class sizes, supervision loads, grant demands, publication pressure and annual appraisal evidence.</p>
      </div>
      <aside><strong>Review-gated autonomy</strong><small>No grade release, portal upload, grant submission, student feedback, journal submission or profile update occurs without recorded lecturer approval.</small></aside>
    </section>

    <section className={styles.workflowGrid} aria-label="Available lecturer agents">
      {(Object.entries(LECTURER_WORKFLOW_DEFINITIONS) as Array<[LecturerWorkflow, typeof definition]>).map(([key, item]) =>
        <button key={key} className={form.workflow === key ? styles.activeWorkflow : ""} onClick={() => changeWorkflow(key)}>
          <span>{item.shortTitle}</span>
          <strong>{item.title}</strong>
          <small>{item.outcome}</small>
        </button>
      )}
    </section>

    <div className={styles.layout}>
      <form className={styles.card} onSubmit={createCase}>
        <div className={styles.sectionLabel}>Create agent case</div>
        <h2>{definition.shortTitle}</h2>
        <p>{definition.problem}</p>
        <label><span>Lecturer name *</span><input required value={form.lecturerName} onChange={(event) => setForm({ ...form, lecturerName: event.target.value })} /></label>
        <label><span>Institution *</span><input required value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} /></label>
        <label><span>Department</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <label><span>Case title *</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. PUA 301 second-semester results" /></label>
        <div className={styles.two}>
          <label><span>Students / items</span><input type="number" min={0} max={100000} value={form.workloadCount} onChange={(event) => setForm({ ...form, workloadCount: Number(event.target.value) })} /></label>
          <label><span>Budget currency</span><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>NGN</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
        </div>
        <label><span>Context and instructions</span><textarea value={form.context} onChange={(event) => setForm({ ...form, context: event.target.value })} placeholder="Deadlines, institutional rules, course weights, grant call, student cohort, journal target or appraisal year…" /></label>
        <fieldset>
          <legend>Evidence already available</legend>
          {definition.evidence.map((item) => <label className={styles.check} key={item}><input type="checkbox" checked={suppliedEvidence.includes(item)} onChange={(event) => setSuppliedEvidence((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} /><span>{item}</span></label>)}
        </fieldset>
        <button className={styles.primary} disabled={saving}>{saving ? "Saving workflow…" : "Create review-gated plan"}</button>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </form>

      <section className={styles.casePanel}>
        <div className={styles.caseHeader}>
          <div><span className={styles.sectionLabel}>Persistent case ledger</span><h2>{selected ? selected.title : "No lecturer case selected"}</h2></div>
          <select aria-label="Select lecturer workflow case" value={selected?._id || ""} onChange={(event) => setSelectedId(event.target.value)} disabled={!cases.length}>
            {cases.map((item) => <option key={item._id} value={item._id}>{item.caseNumber} · {item.title}</option>)}
          </select>
        </div>
        {loading ? <div className={styles.empty}>Loading persistent workflow memory…</div> : !selected ? <div className={styles.empty}>Create the first case to generate its evidence checklist, autonomous plan and lecturer approval gates.</div> : <>
          <div className={styles.summary}>
            <div><span>Status</span><strong>{humanize(selected.status)}</strong></div>
            <div><span>Agent</span><strong>{LECTURER_WORKFLOW_DEFINITIONS[selected.workflow].shortTitle}</strong></div>
            <div><span>Workload</span><strong>{selected.workloadCount.toLocaleString()}</strong></div>
            <div><span>External execution</span><strong>{selected.externalExecutionEnabled ? "enabled" : "locked"}</strong></div>
          </div>
          <div className={styles.notice}><strong>Execution boundary:</strong> this release creates plans, evidence ledgers and approval records. Live OCR, cloud-folder monitoring and third-party portal execution activate only after their integrations and permissions are configured.</div>
          <h3>Evidence ledger</h3>
          <div className={styles.evidence}>
            {selected.evidence.map((item) => <article key={item.name}><strong>{item.name}</strong><span className={styles[item.status]}>{item.status}</span><div><button disabled={saving} onClick={() => updateEvidence(item.name, "supplied")}>Mark supplied</button><button disabled={saving} onClick={() => updateEvidence(item.name, "verified")}>Verify</button></div></article>)}
          </div>
          <h3>Agent plan and approval gates</h3>
          <div className={styles.steps}>
            {selected.steps.map((step, index) => <article key={step.id} className={step.requiresApproval ? styles.gate : ""}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <div><span>{humanize(step.kind)} · {humanize(step.status)}</span><strong>{step.label}</strong><p>{step.description}</p>{step.requiresApproval ? <div className={styles.approvals}><b>{step.approvalLabel}</b><button disabled={saving || step.status === "approved"} onClick={() => decide(step.id, "approved")}>Approve</button><button disabled={saving || step.status === "rejected"} onClick={() => decide(step.id, "rejected")}>Reject</button></div> : <div className={styles.approvals}><button disabled={saving || step.status === "completed"} onClick={() => completeStep(step.id)}>{step.status === "completed" ? "Completed" : "Mark step complete"}</button></div>}</div>
            </article>)}
          </div>
        </>}
      </section>
    </div>
  </main>;
}
