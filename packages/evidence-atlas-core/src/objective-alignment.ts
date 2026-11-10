/**
 * Evidence Atlas objective alignment: researcher-authored, claim-linked review matrix.
 * No automatic hypothesis testing, variable inference, or causal assertions.
 * Framework-neutral and safe for use in browser or later standalone service.
 */
import type { AtlasProject } from "./index";

export type AtlasObjective = {
  id: string;
  objectiveText: string;
  researchQuestion: string;
  hypothesis: string;
  focusVariable: string;
  outcomeVariable: string;
  claimIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type AtlasObjectiveInput = Pick<AtlasObjective,
  "objectiveText" | "researchQuestion" | "hypothesis" | "focusVariable" | "outcomeVariable" | "claimIds">;
export type ObjectiveCoverage = {
  objectiveId: string;
  linkedClaims: number;
  reviewedSources: number;
  abstractOnly: number;
  supports: number;
  contradicts: number;
  mixed: number;
  unclear: number;
  status: "no-linked-claims" | "no-reviewed-evidence" | "abstract-only" | "researcher-reviewed";
  prompts: string[];
};

function normalize(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function unique<T>(items: T[]): T[] { return [...new Set(items)]; }

export function validObjective(value: unknown, knownClaims: Set<string>): value is AtlasObjective {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || input.id.length < 5 || input.id.length > 120 ||
      typeof input.createdAt !== "string" || input.createdAt.length > 64 ||
      typeof input.updatedAt !== "string" || input.updatedAt.length > 64) return false;
  const lengths: Array<[string, number, number]> = [
    ["objectiveText", 12, 500], ["researchQuestion", 8, 500], ["hypothesis", 0, 450],
    ["focusVariable", 3, 150], ["outcomeVariable", 0, 150],
  ];
  if (!lengths.every(([field, min, max]) => typeof input[field] === "string" &&
       String(input[field]).trim().length >= min && String(input[field]).length <= max)) return false;
  return Array.isArray(input.claimIds) && input.claimIds.length <= 12 &&
    input.claimIds.every((id) => typeof id === "string" && knownClaims.has(id)) &&
    unique(input.claimIds).length === input.claimIds.length;
}
function inputToObjective(project: AtlasProject, input: AtlasObjectiveInput, previous?: AtlasObjective): AtlasObjective {
  const objectiveText = normalize(input.objectiveText, 500);
  const researchQuestion = normalize(input.researchQuestion, 500);
  const hypothesis = normalize(input.hypothesis, 450);
  const focusVariable = normalize(input.focusVariable, 150);
  const outcomeVariable = normalize(input.outcomeVariable, 150);
  const claimIds = unique(Array.isArray(input.claimIds) ? input.claimIds : []);
  if (objectiveText.length < 12 || researchQuestion.length < 8 || focusVariable.length < 3) {
    throw new Error("Supply a specific objective, matching research question and one measurable focus variable.");
  }
  if (outcomeVariable && outcomeVariable.toLowerCase() === focusVariable.toLowerCase()) {
    throw new Error("Focus and outcome variables should not be identical when both are provided.");
  }
  if (claimIds.length > 12 || claimIds.some((id) => !project.claims.some((c) => c.id === id))) {
    throw new Error("Select up to twelve existing research claims.");
  }
  const timestamp = new Date().toISOString();
  return { id: previous?.id || crypto.randomUUID(), objectiveText, researchQuestion, hypothesis,
    focusVariable, outcomeVariable, claimIds, createdAt: previous?.createdAt || timestamp, updatedAt: timestamp };
}
function withEvent(project: AtlasProject, objectives: AtlasObjective[], action: string, text: string): AtlasProject {
  const timestamp = new Date().toISOString();
  return {
    ...project, objectives, updatedAt: timestamp,
    events: [...project.events.slice(-248), { id: crypto.randomUUID(), at: timestamp,
      action, summary: text.slice(0, 300) }],
  };
}
export function addAtlasObjective(project: AtlasProject, input: AtlasObjectiveInput): AtlasProject {
  if ((project.objectives || []).length >= 12) throw new Error("A project can contain up to twelve objectives.");
  const objective = inputToObjective(project, input);
  if ((project.objectives || []).some((x) => x.objectiveText.toLowerCase() === objective.objectiveText.toLowerCase())) {
    throw new Error("That objective is already in the project.");
  }
  return withEvent(project, [...(project.objectives || []), objective], "objective-added", objective.objectiveText);
}
export function updateAtlasObjective(project: AtlasProject, objectiveId: string, input: AtlasObjectiveInput): AtlasProject {
  const original = (project.objectives || []).find((x) => x.id === objectiveId);
  if (!original) throw new Error("That research objective does not exist.");
  const updated = inputToObjective(project, input, original);
  if ((project.objectives || []).some((x) => x.id !== objectiveId &&
      x.objectiveText.toLowerCase() === updated.objectiveText.toLowerCase())) {
    throw new Error("Another objective already uses that description.");
  }
  return withEvent(project, (project.objectives || []).map((x) => x.id === objectiveId ? updated : x),
    "objective-revised", updated.objectiveText);
}
export function removeAtlasObjective(project: AtlasProject, objectiveId: string): AtlasProject {
  const prior = (project.objectives || []).find((x) => x.id === objectiveId);
  if (!prior) throw new Error("That research objective does not exist.");
  return withEvent(project, (project.objectives || []).filter((x) => x.id !== objectiveId),
    "objective-removed", prior.objectiveText);
}
export function analyzeObjectiveCoverage(project: AtlasProject, objective: AtlasObjective): ObjectiveCoverage {
  const links = new Set(objective.claimIds);
  const entries = project.evidence.filter((item) => links.has(item.claimId));
  const reviewedSources = unique(entries.map((x) => x.paperId)).length;
  const abstractOnly = entries.filter((x) => x.basis === "abstract").length;
  const prompts: string[] = [];
  if (!objective.claimIds.length) prompts.push("Link research propositions that directly address this objective.");
  if (!entries.length) prompts.push("No source assessment currently addresses the linked proposition(s).");
  if (abstractOnly) prompts.push(abstractOnly + " assessment(s) rely on abstracts; verify results against full text.");
  if (entries.some((e) => project.papers.some((p) => p.id === e.paperId && p.retracted))) {
    prompts.push("At least one linked source carries a retraction metadata flag; verify its current status.");
  }
  const conflicting = entries.some((e) => e.stance === "supports") &&
    entries.some((e) => e.stance === "contradicts");
  if (conflicting) prompts.push("Opposing researcher classifications require outcome and methods comparability checks.");
  if (!objective.outcomeVariable) prompts.push("If the objective tests an effect or association, specify the measured outcome variable.");
  if (!objective.hypothesis) prompts.push("No hypothesis has been entered; this may be appropriate for an exploratory or qualitative objective.");
  const status: ObjectiveCoverage["status"] = !objective.claimIds.length ? "no-linked-claims" :
    !entries.length ? "no-reviewed-evidence" :
    entries.every((e) => e.basis === "abstract") ? "abstract-only" : "researcher-reviewed";
  return {
    objectiveId: objective.id, linkedClaims: objective.claimIds.length, reviewedSources, abstractOnly,
    supports: entries.filter((e) => e.stance === "supports").length,
    contradicts: entries.filter((e) => e.stance === "contradicts").length,
    mixed: entries.filter((e) => e.stance === "mixed").length,
    unclear: entries.filter((e) => e.stance === "unclear").length, status, prompts,
  };
}
export function renderObjectiveAlignmentReport(project: AtlasProject, timestamp = new Date().toISOString()): string {
  const lines = [
    "# MABRIG Evidence Atlas — Objective Alignment Matrix",
    "",
    "Project: " + project.title,
    "Research question: " + project.question,
    "Generated: " + timestamp,
    "",
    "> Researcher-defined variable and objective alignment. Counts reflect saved classifications, not statistical hypothesis tests, evidence certainty or field-wide consensus.",
    "",
  ];
  const objectives = project.objectives || [];
  if (!objectives.length) lines.push("No research objectives have been defined.", "");
  for (const [index, objective] of objectives.entries()) {
    const coverage = analyzeObjectiveCoverage(project, objective);
    lines.push(
      "## Objective " + (index + 1), "",
      "- Statement: " + objective.objectiveText,
      "- Corresponding research question: " + objective.researchQuestion,
      "- Hypothesis (researcher-entered): " + (objective.hypothesis || "Not specified"),
      "- Measurable focus variable: " + objective.focusVariable,
      "- Outcome variable: " + (objective.outcomeVariable || "Not specified"),
      "- Linked propositions: " + coverage.linkedClaims,
      "- Distinct papers assessed: " + coverage.reviewedSources,
      "- Evidence review status: " + coverage.status,
      "- Classification counts (not consensus): support=" + coverage.supports +
        ", contradict=" + coverage.contradicts + ", mixed=" + coverage.mixed +
        ", unclear=" + coverage.unclear + "; abstract-only=" + coverage.abstractOnly, ""
    );
    for (const claimId of objective.claimIds) {
      const claim = project.claims.find((c) => c.id === claimId);
      if (!claim) continue;
      lines.push("### Proposition: " + claim.text, "");
      for (const evidence of project.evidence.filter((e) => e.claimId === claimId)) {
        const paper = project.papers.find((p) => p.id === evidence.paperId);
        if (!paper) continue;
        lines.push("- " + paper.title + " — https://doi.org/" +
          encodeURIComponent(paper.doi).replace("%2F", "/") +
          " — researcher classified " + evidence.stance + " (" + evidence.basis + ", " +
          (evidence.locator || "locator not recorded") + ")");
      }
      lines.push("");
    }
    if (coverage.prompts.length) {
      lines.push("### Follow-up questions", "", ...coverage.prompts.map((p) => "- " + p), "");
    }
  }
  lines.push(
    "## Limitations", "",
    "- Research objectives and variables are manually defined and must be checked against departmental or institutional requirements.",
    "- Literature classifications are not statistical tests of the objectives or hypotheses.",
    "- DOI metadata does not verify study findings, methods, indexing, or originality.",
    "- Review scope is limited to this locally saved set of papers and researcher-entered assessments.", ""
  );
  return lines.join("\n");
}
