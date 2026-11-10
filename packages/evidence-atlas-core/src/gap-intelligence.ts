/** Evidence Atlas deterministic evidence-coverage and gap-audit engine.
 * These are research FOLLOW-UP PROMPTS about the saved corpus, never conclusions
 * about gaps in all published literature. No network, AI calls, or secrets.
 */
import type { AtlasProject, AtlasEvidence } from "./index";

export type GapKind = "unreviewed-claim" | "thin-evidence" | "potential-disagreement" |
  "abstract-only" | "uncertain-evidence" | "unreviewed-papers" | "no-search-log" |
  "missing-methods" | "missing-locator" | "retraction-flag";

export type GapSignal = {
  id: string;
  kind: GapKind;
  claimId: string | null;
  priority: "review-first" | "investigate" | "document";
  title: string;
  observation: string;
  followUpQuestion: string;
  nextStep: string;
  paperIds: string[];
  assessmentIds: string[];
};

export type AtlasGapAudit = {
  generatedAt: string;
  totals: {
    papers: number; claims: number; assessedPapers: number; unassessedPapers: number;
    assessments: number; abstractOnly: number; unresolved: number;
    searchEvents: number; retractionSignals: number;
  };
  signals: GapSignal[];
  caveats: string[];
};

const CAVEATS = [
  "These signals describe only this saved project's corpus and researcher-entered classifications. Absence here is never evidence that no relevant publication exists.",
  "DOI registration and OpenAlex metadata are not independent verification of reported study findings or quality.",
  "Counts of supporting and contradicting papers are not a consensus score or a meta-analysis. The studies may not be comparable.",
  "Three reviewed assessments is a workflow reminder only, not a validated scientific sufficiency threshold.",
  "Retraction flags are metadata indications, not a real-time verification of publisher corrections.",
];

function uniquePaperIds(entries: AtlasEvidence[]) {
  return [...new Set(entries.map((item) => item.paperId))].sort();
}
function evidenceIds(entries: AtlasEvidence[]) {
  return entries.map((item) => item.id).sort();
}
function signal(input: Omit<GapSignal, "id">): GapSignal {
  return { ...input, id: input.kind + ":" + (input.claimId || "project") };
}
function priority(kind: GapSignal["priority"]) {
  return kind === "review-first" ? 0 : kind === "investigate" ? 1 : 2;
}
function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function analyzeAtlasGaps(project: AtlasProject, generatedAt = new Date().toISOString()): AtlasGapAudit {
  const active = new Set(project.evidence.map((record) => record.paperId));
  const excluded = new Set(project.papers.filter((paper) => paper.retracted).map((paper) => paper.id));
  const unreviewed = project.papers.filter((paper) => !active.has(paper.id));
  const abstractOnly = project.evidence.filter((record) => record.basis === "abstract");
  const uncertain = project.evidence.filter((record) => record.stance === "mixed" || record.stance === "unclear");
  const searchEvents = project.events.filter((event) => event.action === "search");
  const signals: GapSignal[] = [];

  if (searchEvents.length === 0) {
    signals.push(signal({ kind: "no-search-log", claimId: null, priority: "document",
      title: "Search coverage cannot be reconstructed",
      observation: "No literature-search events are recorded in this local project.",
      followUpQuestion: "Which search databases, terms, date limits, and selection criteria cover the question?",
      nextStep: "Perform tracked searches and document screening and exclusion decisions.",
      paperIds: [], assessmentIds: [] }));
  }

  if (unreviewed.length > 0) {
    signals.push(signal({ kind: "unreviewed-papers", claimId: null, priority: "investigate",
      title: "Saved papers have not been assessed",
      observation: unreviewed.length + " of " + project.papers.length + " saved papers have no claim-linked assessment.",
      followUpQuestion: "Which papers contribute evidence to the claims, and which are outside the inclusion criteria?",
      nextStep: "Screen and link relevant findings, or document justified exclusions.",
      paperIds: unreviewed.map((paper) => paper.id).sort(), assessmentIds: [] }));
  }

  for (const claim of project.claims) {
    const matches = project.evidence.filter((record) => record.claimId === claim.id);
    const eligible = matches.filter((record) => !excluded.has(record.paperId));
    const common = { claimId: claim.id, paperIds: uniquePaperIds(matches), assessmentIds: evidenceIds(matches) };
    if (matches.length === 0) {
      signals.push(signal({ ...common, kind: "unreviewed-claim", priority: "review-first",
        title: "Claim has no linked evidence",
        observation: "No source has been assessed against the proposition: " + clean(claim.text).slice(0, 180),
        followUpQuestion: "Which studies directly examine this specific proposition?",
        nextStep: "Extend the search and review source results before classifying support, contradiction or uncertainty." }));
      continue;
    }
    if (eligible.length < 3) {
      signals.push(signal({ ...common, kind: "thin-evidence", priority: "investigate",
        title: "Only a small number of sources assessed",
        observation: eligible.length + " source assessment(s) without retraction flags for this claim; the threshold is a workflow reminder only.",
        followUpQuestion: "What additional comparable studies should be evaluated?",
        nextStep: "Broaden and document the search; compare relevant populations, study designs and null results." }));
    }
    const supporting = eligible.filter((record) => record.stance === "supports");
    const contradicting = eligible.filter((record) => record.stance === "contradicts");
    if (supporting.length && contradicting.length) {
      signals.push(signal({ ...common, kind: "potential-disagreement", priority: "review-first",
        title: "Different classifications across sources",
        observation: supporting.length + " reviewed source(s) were classified as supporting and " +
          contradicting.length + " as contradicting; designs, outcomes and populations may differ.",
        followUpQuestion: "Can methodology or population differences explain the apparent disagreement?",
        nextStep: "Inspect comparable full-text results, estimates, outcome measures, populations and limitations before claiming a contradiction." }));
    }
    if (matches.every((record) => record.basis === "abstract")) {
      signals.push(signal({ ...common, kind: "abstract-only", priority: "review-first",
        title: "Assessment relies entirely on abstracts",
        observation: "All " + matches.length + " recorded assessments for this claim are abstract-only.",
        followUpQuestion: "Would full-text methods and results support these preliminary classifications?",
        nextStep: "Read lawfully accessible full texts and capture specific result passages and page/table locations." }));
    }
    const unresolved = eligible.filter((record) => record.stance === "mixed" || record.stance === "unclear");
    if (unresolved.length) {
      signals.push(signal({ ...common, kind: "uncertain-evidence", priority: "investigate",
        title: "Mixed or uncertain source classifications",
        observation: unresolved.length + " source assessment(s) are mixed or unclear for this claim.",
        followUpQuestion: "What source details might clarify the uncertainty?",
        nextStep: "Review estimates, uncertainty and risk of bias; retain an uncertain classification when warranted." }));
    }
  }

  const withoutMethods = project.evidence.filter((record) => !clean(record.notes));
  if (withoutMethods.length) {
    signals.push(signal({ kind: "missing-methods", claimId: null, priority: "document",
      title: "Methodological context missing",
      observation: withoutMethods.length + " source assessment(s) omit methodological or limitation notes.",
      followUpQuestion: "Are study designs, measures and populations sufficiently comparable?",
      nextStep: "Add source-checked methods, limitations and relevant measurement details.",
      paperIds: uniquePaperIds(withoutMethods), assessmentIds: evidenceIds(withoutMethods) }));
  }
  const withoutLocators = project.evidence.filter((record) => !clean(record.locator));
  if (withoutLocators.length) {
    signals.push(signal({ kind: "missing-locator", claimId: null, priority: "document",
      title: "Passage locators are missing",
      observation: withoutLocators.length + " quoted passages do not have a page, table or section locator.",
      followUpQuestion: "Can another researcher independently locate these quotations?",
      nextStep: "Capture pages or headings, or state clearly when pagination is unavailable.",
      paperIds: uniquePaperIds(withoutLocators), assessmentIds: evidenceIds(withoutLocators) }));
  }
  const retracted = project.papers.filter((paper) => paper.retracted);
  if (retracted.length) {
    const linked = project.evidence.filter((record) => excluded.has(record.paperId));
    signals.push(signal({ kind: "retraction-flag", claimId: null, priority: "review-first",
      title: "Potential retraction signals require checking",
      observation: retracted.length + " saved source(s) carry an indexed retraction flag, which may be stale.",
      followUpQuestion: "What is the current authoritative status of the flagged source(s)?",
      nextStep: "Check the publisher's current record and any corrections or retraction notices before synthesizing evidence.",
      paperIds: retracted.map((paper) => paper.id).sort(), assessmentIds: evidenceIds(linked) }));
  }

  return {
    generatedAt,
    totals: {
      papers: project.papers.length, claims: project.claims.length,
      assessedPapers: active.size, unassessedPapers: unreviewed.length,
      assessments: project.evidence.length, abstractOnly: abstractOnly.length,
      unresolved: uncertain.length, searchEvents: searchEvents.length,
      retractionSignals: retracted.length,
    },
    signals: signals.sort((a, b) => priority(a.priority) - priority(b.priority) || a.id.localeCompare(b.id)),
    caveats: CAVEATS,
  };
}

function markdown(value: string) {
  return value.replace(/\r?\n/g, " ").replace(/([\\*_<>])/g, "\\$1").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export function renderAtlasGapReport(project: AtlasProject, audit: AtlasGapAudit): string {
  const paperById = new Map(project.papers.map((paper) => [paper.id, paper]));
  const t = audit.totals;
  const lines = [
    "# Evidence Atlas — project-scoped research-gap audit",
    "", "Project: " + markdown(project.title),
    "Research question: " + markdown(project.question),
    "Generated: " + audit.generatedAt,
    "", "## Local corpus coverage", "",
    "- Papers saved: " + t.papers, "- Claims: " + t.claims,
    "- Papers assessed: " + t.assessedPapers,
    "- Papers unassessed: " + t.unassessedPapers,
    "- Source assessments: " + t.assessments,
    "- Abstract-only assessments: " + t.abstractOnly,
    "- Mixed or unclear assessments: " + t.unresolved,
    "- Logged searches: " + t.searchEvents,
    "- Retraction metadata flags: " + t.retractionSignals,
    "", "## Follow-up prompts — not confirmed scientific research gaps", "",
  ];
  if (audit.signals.length === 0) lines.push("No prompts were triggered; this does not establish comprehensive evidence coverage.", "");
  for (const [index, entry] of audit.signals.entries()) {
    lines.push("### " + (index + 1) + ". " + markdown(entry.title), "",
      "- Signal: " + entry.kind,
      "- Scope: " + (entry.claimId ? "Claim ID " + entry.claimId : "Project-wide"),
      "- Priority: " + entry.priority,
      "- Observation: " + markdown(entry.observation),
      "- Research question to investigate: " + markdown(entry.followUpQuestion),
      "- Next step: " + markdown(entry.nextStep),
      "- Evidence record IDs: " + (entry.assessmentIds.join(", ") || "none"),
      "- Sources:");
    if (!entry.paperIds.length) lines.push("  - No source linked");
    for (const id of entry.paperIds) {
      const paper = paperById.get(id);
      if (paper) lines.push("  - " + markdown(paper.title) + " (" + paper.year + ") https://doi.org/" + paper.doi);
    }
    lines.push("");
  }
  lines.push("## Limitations", "");
  for (const caveat of audit.caveats) lines.push("- " + markdown(caveat));
  lines.push("", "Confirm the actual literature search and findings independently before writing a research-gap statement.", "");
  return lines.join("\n");
}
