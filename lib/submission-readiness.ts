export type ReadinessCheck = {
  id: string;
  category: "manuscript" | "ethics" | "references" | "journal" | "files" | "visibility";
  label: string;
  weight: number;
  critical?: boolean;
};

export const READINESS_CHECKS: ReadinessCheck[] = [
  { id: "title-final", category: "manuscript", label: "Title accurately reflects the study and contribution", weight: 4 },
  { id: "abstract-complete", category: "manuscript", label: "Abstract contains the discipline-appropriate core elements and actual findings", weight: 5, critical: true },
  { id: "methods-clear", category: "manuscript", label: "Methods are sufficiently clear and internally consistent", weight: 6, critical: true },
  { id: "results-supported", category: "manuscript", label: "Results/findings are supported by the reported data or evidence", weight: 7, critical: true },
  { id: "discussion-aligned", category: "manuscript", label: "Discussion/conclusion do not overstate the evidence", weight: 4, critical: true },
  { id: "language-reviewed", category: "manuscript", label: "Language, structure and terminology have been technically reviewed", weight: 3 },

  { id: "ethics-statement", category: "ethics", label: "Ethics approval/exemption statement is present where applicable", weight: 6, critical: true },
  { id: "consent-statement", category: "ethics", label: "Consent statement is present where applicable", weight: 4, critical: true },
  { id: "funding-statement", category: "ethics", label: "Funding statement is complete", weight: 3 },
  { id: "coi-statement", category: "ethics", label: "Conflict-of-interest declaration is complete", weight: 4, critical: true },
  { id: "authorship-confirmed", category: "ethics", label: "Authorship/order/contributions have been confirmed by the authors", weight: 5, critical: true },
  { id: "data-availability", category: "ethics", label: "Data/material availability statement is included where required", weight: 3 },

  { id: "citations-match", category: "references", label: "Every in-text citation has a matching reference and vice versa", weight: 5, critical: true },
  { id: "doi-audited", category: "references", label: "DOI-bearing references have passed integrity verification or documented manual review", weight: 4 },
  { id: "reference-style", category: "references", label: "References match the target journal style", weight: 3 },
  { id: "retractions-checked", category: "references", label: "Retraction/correction concerns have been checked for high-risk references", weight: 5, critical: true },

  { id: "scope-fit", category: "journal", label: "Target journal scope matches the manuscript", weight: 6, critical: true },
  { id: "journal-verified", category: "journal", label: "Journal legitimacy/indexing claims have been independently verified", weight: 6, critical: true },
  { id: "fees-verified", category: "journal", label: "APC/submission fees and waiver conditions have been verified on current official sources", weight: 4 },
  { id: "guidelines-current", category: "journal", label: "Current author guidelines were checked before final formatting", weight: 5, critical: true },

  { id: "word-count", category: "files", label: "Word count and article-type limits are satisfied", weight: 3 },
  { id: "tables-figures", category: "files", label: "Tables/figures are numbered, cited, legible and supplied in acceptable formats", weight: 4 },
  { id: "supplementary", category: "files", label: "Required supplementary files/checklists are prepared", weight: 2 },
  { id: "cover-letter", category: "files", label: "Cover letter is prepared and journal-specific", weight: 3 },
  { id: "blind-review", category: "files", label: "Blinded/unblinded files match the journal's peer-review model", weight: 4, critical: true },

  { id: "orcid-ready", category: "visibility", label: "Author ORCID/name/affiliation metadata are consistent", weight: 2 },
  { id: "doi-metadata-plan", category: "visibility", label: "DOI and canonical bibliographic metadata plan is clear", weight: 2 },
  { id: "scholar-plan", category: "visibility", label: "Post-publication Google Scholar/repository discoverability plan is documented", weight: 2 },
];

export type ReadinessResult = {
  score: number;
  decision: "GO" | "CONDITIONAL GO" | "HOLD";
  completedWeight: number;
  totalWeight: number;
  criticalFailures: ReadinessCheck[];
  missing: ReadinessCheck[];
  categoryScores: Record<string, number>;
};

export function calculateSubmissionReadiness(completedIds: string[]): ReadinessResult {
  const completed = new Set(completedIds);
  const totalWeight = READINESS_CHECKS.reduce((sum, check) => sum + check.weight, 0);
  const completedWeight = READINESS_CHECKS.filter((check) => completed.has(check.id)).reduce((sum, check) => sum + check.weight, 0);
  const score = Math.round((completedWeight / totalWeight) * 100);
  const missing = READINESS_CHECKS.filter((check) => !completed.has(check.id));
  const criticalFailures = missing.filter((check) => check.critical);

  const categories = [...new Set(READINESS_CHECKS.map((check) => check.category))];
  const categoryScores: Record<string, number> = {};
  for (const category of categories) {
    const checks = READINESS_CHECKS.filter((check) => check.category === category);
    const total = checks.reduce((sum, check) => sum + check.weight, 0);
    const done = checks.filter((check) => completed.has(check.id)).reduce((sum, check) => sum + check.weight, 0);
    categoryScores[category] = Math.round((done / total) * 100);
  }

  let decision: ReadinessResult["decision"] = "HOLD";
  if (score >= 90 && criticalFailures.length === 0) decision = "GO";
  else if (score >= 75 && criticalFailures.length <= 1) decision = "CONDITIONAL GO";

  return { score, decision, completedWeight, totalWeight, criticalFailures, missing, categoryScores };
}
