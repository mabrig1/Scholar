/**
 * Evidence Atlas methodological appraisal, v1.
 *
 * Records manually transcribed study context without assigning automatic quality
 * scores. An appraisal is an investigator note, not an independent RoB judgment.
 * Framework-neutral; can be moved to a standalone Evidence Atlas service.
 */
import type { AtlasEvidence, AtlasProject } from "./index";

export const STUDY_DESIGNS = [
  "not-reported", "randomized-trial", "quasi-experimental", "cohort",
  "case-control", "cross-sectional", "qualitative", "mixed-methods",
  "systematic-review", "other",
] as const;
export const SAMPLING_METHODS = ["not-reported", "probability", "non-probability", "census", "not-applicable"] as const;
export const BIAS_NOTES = ["not-reviewed", "no-concern-noted", "potential-concern", "major-concern-noted"] as const;

export type StudyDesign = typeof STUDY_DESIGNS[number];
export type SamplingMethod = typeof SAMPLING_METHODS[number];
export type BiasNote = typeof BIAS_NOTES[number];

export type AtlasMethodAppraisal = {
  studyDesign: StudyDesign;
  setting: string;
  population: string;
  sampleSize: number | null;
  samplingMethod: SamplingMethod;
  outcomeMeasure: string;
  effectEstimate: string;
  uncertainty: string;
  methodsLocator: string;
  selectionBias: BiasNote;
  confounding: BiasNote;
  measurementBias: BiasNote;
  missingData: BiasNote;
  limitations: string;
  appraisedAt: string;
};

export type AtlasMethodAppraisalInput = Omit<AtlasMethodAppraisal, "appraisedAt"> & {
  /** An affirmative declaration, not an externally verifiable assertion. */
  sourceReviewed: boolean;
};

export type AppraisalReadiness = {
  status: "not-appraised" | "abstract-preliminary" | "methods-incomplete" | "context-recorded";
  label: string;
  caveats: string[];
};

export type AtlasComparabilityFlag = {
  id: string;
  paperIds: [string, string];
  kinds: Array<"methods-unreported" | "design-difference" | "setting-difference" | "outcome-difference" | "abstract-only">;
  explanation: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
function validDate(value: unknown) {
  return typeof value === "string" && value.length >= 10 && value.length <= 48 && Number.isFinite(Date.parse(value));
}
export function isValidMethodAppraisal(value: unknown): value is AtlasMethodAppraisal {
  if (!isRecord(value)) return false;
  const appraisal = value;
  return oneOf(appraisal.studyDesign, STUDY_DESIGNS) &&
    oneOf(appraisal.samplingMethod, SAMPLING_METHODS) &&
    oneOf(appraisal.selectionBias, BIAS_NOTES) &&
    oneOf(appraisal.confounding, BIAS_NOTES) &&
    oneOf(appraisal.measurementBias, BIAS_NOTES) &&
    oneOf(appraisal.missingData, BIAS_NOTES) &&
    isText(appraisal.setting, 250) && isText(appraisal.population, 250) &&
    isText(appraisal.outcomeMeasure, 250) && isText(appraisal.effectEstimate, 250) &&
    isText(appraisal.uncertainty, 250) && isText(appraisal.methodsLocator, 150) &&
    appraisal.methodsLocator.trim().length >= 3 &&
    isText(appraisal.limitations, 1200) &&
    (appraisal.sampleSize === null ||
      (typeof appraisal.sampleSize === "number" && Number.isSafeInteger(appraisal.sampleSize) &&
       appraisal.sampleSize >= 1 && appraisal.sampleSize <= 1_000_000_000)) &&
    validDate(appraisal.appraisedAt);
}
export function recordMethodAppraisal(project: AtlasProject, evidenceId: string, input: AtlasMethodAppraisalInput): AtlasProject {
  const evidence = project.evidence.find((item) => item.id === evidenceId);
  if (!evidence) throw new Error("Select an existing assessed claim-and-paper link before appraising.");
  if (input.sourceReviewed !== true) {
    throw new Error("Confirm that you inspected the source before saving a methodological appraisal.");
  }
  const appraisal: AtlasMethodAppraisal = {
    studyDesign: input.studyDesign,
    setting: text(input.setting, 250),
    population: text(input.population, 250),
    sampleSize: input.sampleSize,
    samplingMethod: input.samplingMethod,
    outcomeMeasure: text(input.outcomeMeasure, 250),
    effectEstimate: text(input.effectEstimate, 250),
    uncertainty: text(input.uncertainty, 250),
    methodsLocator: text(input.methodsLocator, 150),
    selectionBias: input.selectionBias,
    confounding: input.confounding,
    measurementBias: input.measurementBias,
    missingData: input.missingData,
    limitations: text(input.limitations, 1200),
    appraisedAt: new Date().toISOString(),
  };
  if (!isValidMethodAppraisal(appraisal)) throw new Error("Review the appraisal fields and add a valid source methods locator.");
  const hasContext = appraisal.studyDesign !== "not-reported" ||
    Boolean(appraisal.setting || appraisal.population || appraisal.outcomeMeasure || appraisal.effectEstimate ||
      appraisal.uncertainty || appraisal.limitations || appraisal.sampleSize) ||
    [appraisal.selectionBias, appraisal.confounding, appraisal.measurementBias, appraisal.missingData]
      .some((item) => item !== "not-reviewed");
  if (!hasContext) throw new Error("Record at least one source-checked method, result or limitation.");
  const timestamp = new Date().toISOString();
  const nextEvidence: AtlasEvidence[] = project.evidence.map((item) =>
    item.id === evidenceId ? { ...item, appraisal } : item
  );
  const action = evidence.appraisal ? "method-appraisal-revised" : "method-appraisal-recorded";
  return {
    ...project,
    evidence: nextEvidence,
    updatedAt: timestamp,
    events: [...project.events.slice(-248), {
      id: crypto.randomUUID(),
      at: timestamp,
      action,
      summary: "Recorded researcher-entered methods context for " +
        (project.papers.find((paper) => paper.id === evidence.paperId)?.doi || evidence.paperId) +
        "; review scope: " + evidence.basis + ".",
    }],
  };
}
export function assessAppraisalReadiness(evidence: AtlasEvidence): AppraisalReadiness {
  if (!evidence.appraisal) return {
    status: "not-appraised", label: "No methodological appraisal",
    caveats: ["Record study design, population and outcome measurement after inspecting the source."],
  };
  const appraisal = evidence.appraisal;
  const caveats: string[] = [];
  if (evidence.basis === "abstract") {
    caveats.push("Abstract-only appraisal: methods and results have not been checked in full text.");
  }
  if (!appraisal.outcomeMeasure || appraisal.studyDesign === "not-reported") {
    caveats.push("Study design or measured outcome is missing; comparability cannot be established.");
  }
  if ([appraisal.selectionBias, appraisal.confounding, appraisal.measurementBias, appraisal.missingData]
      .every((item) => item === "not-reviewed")) {
    caveats.push("No structured bias concerns have been reviewed.");
  }
  if (evidence.basis === "abstract") {
    return { status: "abstract-preliminary", label: "Preliminary: abstract only", caveats };
  }
  if (appraisal.studyDesign === "not-reported" || !appraisal.outcomeMeasure) {
    return { status: "methods-incomplete", label: "Methods still incomplete", caveats };
  }
  return { status: "context-recorded", label: "Methodological context recorded", caveats };
}
function comparableText(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}
/**
 * An observational comparison checklist only. It does not adjudicate statistical
 * heterogeneity, truth, causal strength, meta-analysis eligibility, or study quality.
 */
export function compareOpposingAtlasEvidence(project: AtlasProject, claimId: string): AtlasComparabilityFlag[] {
  const excluded = new Set(project.papers.filter((paper) => paper.retracted).map((paper) => paper.id));
  const positive = project.evidence.filter((entry) => entry.claimId === claimId &&
    entry.stance === "supports" && !excluded.has(entry.paperId));
  const negative = project.evidence.filter((entry) => entry.claimId === claimId &&
    entry.stance === "contradicts" && !excluded.has(entry.paperId));
  const flags: AtlasComparabilityFlag[] = [];
  for (const a of positive) {
    for (const b of negative) {
      if (flags.length >= 8) return flags;
      const kinds: AtlasComparabilityFlag["kinds"] = [];
      const appA = a.appraisal;
      const appB = b.appraisal;
      if (!appA || !appB) {
        kinds.push("methods-unreported");
      } else {
        if (appA.studyDesign !== "not-reported" && appB.studyDesign !== "not-reported" &&
            appA.studyDesign !== appB.studyDesign) kinds.push("design-difference");
        if (appA.setting && appB.setting && !comparableText(appA.setting, appB.setting)) kinds.push("setting-difference");
        if (appA.outcomeMeasure && appB.outcomeMeasure && !comparableText(appA.outcomeMeasure, appB.outcomeMeasure)) {
          kinds.push("outcome-difference");
        }
        if (appA.studyDesign === "not-reported" || appB.studyDesign === "not-reported" ||
            !appA.outcomeMeasure || !appB.outcomeMeasure) kinds.push("methods-unreported");
      }
      if (a.basis === "abstract" || b.basis === "abstract") kinds.push("abstract-only");
      if (!kinds.length) continue;
      flags.push({
        id: a.id + ":" + b.id,
        paperIds: [a.paperId, b.paperId],
        kinds,
        explanation: kinds.includes("methods-unreported")
          ? "Opposing researcher classifications require more source-checked methodological context."
          : "Potentially non-comparable study contexts. Check populations, design, outcome definitions and estimates before calling this a direct contradiction.",
      });
    }
  }
  return flags;
}


/**
 * Plain Markdown review appendix. It is not a systematic-review quality table,
 * risk-of-bias assessment, evidence certainty grade, or independent verification.
 */
export function renderMethodAppraisalReport(project: AtlasProject, generatedAt = new Date().toISOString()): string {
  const plain = (input: unknown) => String(input ?? "Not entered").replace(/\s+/g, " ").trim().slice(0, 1500) || "Not entered";
  const lines = [
    "# MABRIG Evidence Atlas — Methodological Context Review",
    "",
    "Project: " + plain(project.title),
    "Research question: " + plain(project.question),
    "Generated: " + plain(generatedAt),
    "",
    "> These appraisals are user-entered study notes. This is NOT a validated risk-of-bias instrument, evidence-certainty grade, quality score, causal finding or statistical meta-analysis. Abstract-only notes are provisional.",
    "",
    "Reviewed source-to-claim links: " + project.evidence.length,
    "Links with a methods appraisal: " + project.evidence.filter((item) => item.appraisal).length,
    "",
  ];
  for (const [index, claim] of project.claims.entries()) {
    lines.push("## Claim " + (index + 1) + " — " + plain(claim.text), "");
    const entries = project.evidence.filter((item) => item.claimId === claim.id);
    if (!entries.length) lines.push("No source-linked assessments recorded.", "");
    for (const entry of entries) {
      const paper = project.papers.find((item) => item.id === entry.paperId);
      const a = entry.appraisal;
      lines.push("### " + plain(paper?.title || "Source unavailable"), "",
        "- DOI: " + (paper ? "https://doi.org/" + encodeURIComponent(paper.doi).replace("%2F", "/") : "Unavailable"),
        "- Source scope: " + entry.basis,
        "- Reviewer classification: " + entry.stance,
        "- Evidence excerpt: " + plain(entry.excerpt),
        "- Source passage locator: " + plain(entry.locator),
        "- Appraisal status: " + assessAppraisalReadiness(entry).label);
      if (a) {
        lines.push(
          "- Study design: " + a.studyDesign,
          "- Setting: " + plain(a.setting),
          "- Population: " + plain(a.population),
          "- Sample size: " + (a.sampleSize ?? "Not reported"),
          "- Sampling method: " + a.samplingMethod,
          "- Outcome measure: " + plain(a.outcomeMeasure),
          "- Effect estimate: " + plain(a.effectEstimate),
          "- Estimate uncertainty: " + plain(a.uncertainty),
          "- Methods locator: " + plain(a.methodsLocator),
          "- Bias concern notes: selection=" + a.selectionBias + "; confounding=" + a.confounding +
            "; measurement=" + a.measurementBias + "; missing data=" + a.missingData,
          "- Limitations: " + plain(a.limitations),
          "- Appraised at: " + plain(a.appraisedAt),
        );
      }
      for (const caveat of assessAppraisalReadiness(entry).caveats) lines.push("- Caution: " + plain(caveat));
      lines.push("");
    }
    const flags = compareOpposingAtlasEvidence(project, claim.id);
    if (flags.length) {
      lines.push("### Comparability follow-up prompts", "");
      for (const flag of flags) {
        lines.push("- " + plain(flag.explanation) + " [" + flag.kinds.join(", ") + "]", "");
      }
    }
  }
  lines.push(
    "## Reproducibility limits",
    "",
    "- DOI registry records confirm bibliographic identity, not research findings.",
    "- Study classification, bias notes, outcome definitions and effect estimates require independent checking against original source text.",
    "- Only sources saved in this local project are represented; findings are not a field-wide consensus.",
    "- Retraction flags must be rechecked against publisher and registry updates.",
    "- This appendix does not authorize publication of third-party copyrighted text.",
    ""
  );
  return lines.join("\n");
}
