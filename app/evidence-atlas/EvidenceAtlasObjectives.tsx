"use client";

import { useState, type FormEvent } from "react";
import type { AtlasProject } from "@/lib/evidence-atlas";
import {
  addAtlasObjective, updateAtlasObjective, removeAtlasObjective,
  analyzeObjectiveCoverage, renderObjectiveAlignmentReport, type AtlasObjectiveInput,
} from "@/packages/evidence-atlas-core/src/objective-alignment";
import styles from "./objective-alignment.module.css";

const blank = (): AtlasObjectiveInput => ({
  objectiveText: "", researchQuestion: "", hypothesis: "",
  focusVariable: "", outcomeVariable: "", claimIds: [],
});
function exportAlignment(project: AtlasProject) {
  const file = new Blob([renderObjectiveAlignmentReport(project)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evidence-atlas-objective-matrix-" + project.id.slice(0, 8) + ".md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function EvidenceAtlasObjectives({ project, onUpdate, onError }: {
  project: AtlasProject; onUpdate: (project: AtlasProject, message: string) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<AtlasObjectiveInput>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  function update(name: keyof AtlasObjectiveInput, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }
  function selectClaim(id: string, checked: boolean) {
    setDraft((current) => ({
      ...current, claimIds: checked
        ? [...new Set([...current.claimIds, id])]
        : current.claimIds.filter((item) => item !== id),
    }));
  }
  function cancel() { setEditingId(null); setDraft(blank()); setFormVisible(false); }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = editingId ? updateAtlasObjective(project, editingId, draft) : addAtlasObjective(project, draft);
      onUpdate(next, "Research objective saved and linked to existing evidence claims.");
      cancel();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save this research objective.");
    }
  }
  function startEdit(objective: NonNullable<AtlasProject["objectives"]>[number]) {
    setEditingId(objective.id);
    setDraft({
      objectiveText: objective.objectiveText,
      researchQuestion: objective.researchQuestion,
      hypothesis: objective.hypothesis,
      focusVariable: objective.focusVariable,
      outcomeVariable: objective.outcomeVariable,
      claimIds: [...objective.claimIds],
    });
    setFormVisible(true);
  }
  function remove(id: string) {
    if (!window.confirm("Remove this objective and its claim links? The underlying papers and assessments remain unchanged.")) return;
    try {
      onUpdate(removeAtlasObjective(project, id), "Research objective removed; evidence records were preserved.");
      if (editingId === id) cancel();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to remove objective.");
    }
  }
  return (
    <section className={styles.module} aria-label="Research objective alignment">
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>RESEARCH OBJECTIVE ALIGNMENT</span>
          <h2>Connect each research objective to its evidence</h2>
          <p>Write the objective, matching question, one measurable focus variable and optional outcome and hypothesis. Link propositions already on your map; the system never infers results or performs hypothesis testing.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => exportAlignment(project)}>Export objective matrix (.md)</button>
          <button type="button" onClick={() => { setDraft(blank()); setEditingId(null); setFormVisible(true); }}
            disabled={(project.objectives || []).length >= 12}>+ New objective</button>
        </div>
      </div>
      {formVisible && <form onSubmit={save} className={styles.form}>
        <h3>{editingId ? "Revise objective" : "Add objective"}</h3>
        <label>Specific research objective
          <textarea value={draft.objectiveText} rows={2} maxLength={500} required minLength={12}
            onChange={(e) => update("objectiveText", e.target.value)}
            placeholder="To examine the association between employee training and service performance." />
        </label>
        <label>Matching research question
          <textarea value={draft.researchQuestion} rows={2} maxLength={500} required minLength={8}
            onChange={(e) => update("researchQuestion", e.target.value)}
            placeholder="How does employee training relate to service performance?" />
        </label>
        <div className={styles.two}>
          <label>One measurable focus variable
            <input value={draft.focusVariable} maxLength={150} minLength={3} required
              onChange={(e) => update("focusVariable", e.target.value)} placeholder="Employee training" />
          </label>
          <label>Outcome variable (where relevant)
            <input value={draft.outcomeVariable} maxLength={150}
              onChange={(e) => update("outcomeVariable", e.target.value)} placeholder="Service performance" />
          </label>
        </div>
        <label>Hypothesis (optional; researcher must determine whether appropriate)
          <input value={draft.hypothesis} maxLength={450}
            onChange={(e) => update("hypothesis", e.target.value)} placeholder="H₀: Employee training is not associated with service performance." />
        </label>
        <fieldset className={styles.claimPicker}>
          <legend>Link relevant research propositions (up to twelve)</legend>
          {project.claims.length ? project.claims.map((claim) =>
            <label key={claim.id} className={styles.check}>
              <input type="checkbox" checked={draft.claimIds.includes(claim.id)}
                disabled={!draft.claimIds.includes(claim.id) && draft.claimIds.length >= 12}
                onChange={(e) => selectClaim(claim.id, e.target.checked)} />
              <span>{claim.text}</span>
            </label>) :
            <p>No propositions have been added yet. You can create the objective and link claims later.</p>}
        </fieldset>
        <div className={styles.actions}>
          <button type="submit">Save objective</button>
          <button type="button" onClick={cancel}>Cancel</button>
        </div>
      </form>}
      <div className={styles.records}>
        {(project.objectives || []).map((objective, index) => {
          const coverage = analyzeObjectiveCoverage(project, objective);
          return <article key={objective.id} className={styles.record}>
            <header><strong>Objective {index + 1}: {objective.objectiveText}</strong><span>{coverage.status.replaceAll("-", " ")}</span></header>
            <p><b>Question:</b> {objective.researchQuestion}</p>
            <p><b>Focus variable:</b> {objective.focusVariable} · <b>Outcome:</b> {objective.outcomeVariable || "Not specified"}</p>
            {objective.hypothesis && <p><b>Researcher-entered hypothesis:</b> {objective.hypothesis}</p>}
            <div className={styles.metrics}>
              <span>{coverage.linkedClaims} linked claims</span>
              <span>{coverage.reviewedSources} assessed papers</span>
              <span>{coverage.abstractOnly} abstract-only assessments</span>
              <span>{coverage.supports} support / {coverage.contradicts} contradict</span>
            </div>
            {coverage.prompts.map((prompt) => <p className={styles.prompt} key={prompt}>{prompt}</p>)}
            <div className={styles.actions}>
              <button type="button" onClick={() => startEdit(objective)}>Edit links and variables</button>
              <button type="button" onClick={() => remove(objective.id)}>Remove objective</button>
            </div>
          </article>;
        })}
        {!project.objectives?.length && <p className={styles.empty}>No objectives defined yet. You can add up to twelve, each linked to saved evidence.</p>}
      </div>
      <p className={styles.caution}>Coverage counts are descriptive workflow indicators, not validation of a hypothesis, proof of causal effect, or a measure of research quality. Objective wording must be verified by the researcher.</p>
    </section>
  );
}
