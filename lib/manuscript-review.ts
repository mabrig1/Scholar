/** Browser-safe review contracts and transparent, deterministic screening. */
export const REVIEW_LIMIT = 60_000;
export const REVIEWERS = [
  { id: "methodology", name: "Methodology", focus: "Design, sampling and alignment with the research question" },
  { id: "statistics", name: "Statistical analysis", focus: "Reporting, uncertainty and suitability of statistical claims" },
  { id: "citations", name: "Citation integrity", focus: "Traceability and support for cited claims" },
  { id: "logic", name: "Logical consistency", focus: "Connections between evidence and conclusions" },
  { id: "ethics", name: "Ethical compliance", focus: "Consent, approvals, disclosures and data protection" },
  { id: "reproducibility", name: "Reproducibility", focus: "Data, code and repeatable procedures" },
  { id: "novelty", name: "Novelty assessment", focus: "Contribution and comparison with prior work" },
  { id: "writing", name: "Writing quality", focus: "Clarity, structure and reporting of limitations" },
] as const;
export type ReviewerId = typeof REVIEWERS[number]["id"];
export type ReviewInput = { title: string; text: string; kind: "empirical" | "review" | "theoretical"; scope: "full" | "excerpt" };
export type ReviewFinding = {
  id: string; reviewer: ReviewerId; priority: "major" | "minor" | "question";
  title: string; explanation: string; action: string;
  evidence: { paragraph: number; quote: string } | null;
  origin: "screening" | "ai";
};
export type ReviewReport = {
  version: 1; title: string; kind: ReviewInput["kind"]; scope: ReviewInput["scope"];
  generatedAt: string; wordCount: number; paragraphCount: number;
  mode: "screening" | "ai-assisted"; provider?: string; model?: string;
  findings: ReviewFinding[]; overview: string; notices: string[];
};
export const REVIEW_NOTICE = "Review assistance, not journal peer review or a publication-readiness certificate. Citation validity, novelty, ethical approval and numerical correctness require independent verification. No raw data or external literature is checked by this review.";

export function validateReviewInput(value: unknown): ReviewInput {
  if (!value || typeof value !== "object") throw new Error("Provide manuscript text and a review profile.");
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || v.text.trim().length < 200) throw new Error("Provide at least 200 characters of manuscript text.");
  if (v.text.length > REVIEW_LIMIT) throw new Error("Review up to 60,000 characters at a time. Select an excerpt for longer work.");
  if (!["empirical", "review", "theoretical"].includes(String(v.kind))) throw new Error("Select a valid manuscript type.");
  if (!["full", "excerpt"].includes(String(v.scope))) throw new Error("Select full manuscript or excerpt.");
  return { title: typeof v.title === "string" ? v.title.trim().slice(0, 300) : "Untitled manuscript", text: v.text.trim(), kind: v.kind as ReviewInput["kind"], scope: v.scope as ReviewInput["scope"] };
}

export function manuscriptParagraphs(text: string) {
  return text.replace(/\r\n?/g, "\n").split(/\n+/).map(p => p.trim()).filter(Boolean).map((text, index) => ({ number: index + 1, text }));
}

export function reviewOverview(findings: ReviewFinding[]) {
  const major = findings.filter(f => f.priority === "major").length;
  return `${findings.length} review items across ${new Set(findings.map(f => f.reviewer)).size} review areas; ${major} marked for priority attention. These are reporting checks and review suggestions, not verified defects. Resolve relevant items against the manuscript and source material before seeking human peer review.`;
}

export function screenManuscript(raw: unknown): ReviewReport {
  const input = validateReviewInput(raw);
  const paragraphs = manuscriptParagraphs(input.text);
  const findings: ReviewFinding[] = [];
  const add = (reviewer: ReviewerId, title: string, explanation: string, action: string, match?: RegExp, priority: ReviewFinding["priority"] = "question") => {
    const paragraph = match ? paragraphs.find(p => match.test(p.text)) : undefined;
    const at = paragraph && match ? paragraph.text.search(match) : 0;
    const quote = paragraph ? paragraph.text.slice(Math.max(0, at - 80), Math.max(0, at - 80) + 350) : "";
    findings.push({ id: `screening-${reviewer}-${findings.length + 1}`, reviewer, priority, title, explanation, action, evidence: paragraph ? { paragraph: paragraph.number, quote } : null, origin: "screening" });
  };
  const missing = (reviewer: ReviewerId, pattern: RegExp, title: string, action: string) => {
    if (!pattern.test(input.text)) add(reviewer, title, `No matching reporting language was detected in the supplied ${input.scope === "excerpt" ? "excerpt; this may be covered elsewhere" : "text; this does not prove the information is absent"}.`, action);
  };
  if (input.kind === "empirical") {
    missing("methodology", /\b(sampl\w*|participant\w*|specimen\w*|dataset\w*|case selection)\b/i, "Clarify the study material and selection", "Describe the population, selection process, inclusion criteria and rationale for the sample or dataset.");
    missing("statistics", /\b(confidence interval|credible interval|effect size|uncertainty|qualitative|thematic|interpretive|ethnograph\w*)\b/i, "Check whether uncertainty is reported", "For quantitative results, report appropriate estimates and uncertainty; mark this item not applicable for a wholly qualitative analysis.");
  } else {
    missing("methodology", /\b(search strategy|databases|selection criteria|conceptual|theoretical|argument|framework)\b/i, "Make the review or argument process explicit", "For a review, describe discovery and selection; for a theoretical work, explain premises and the reasoning process.");
  }
  if (/\bp\s*[=<]\s*0\.0+(?![\d])/i.test(input.text)) add("statistics", "Inspect a zero-valued p-value", "A zero-valued p-value was detected. It may be a rounded display rather than an exact probability.", "Check the original statistical output and report the appropriate bound; do not invent a replacement value.", /\bp\s*[=<]\s*0\.0+(?![\d])/i, "major");
  if (/\b(caus\w*|proves?|guarantees?)\b/i.test(input.text)) add("logic", "Check the strength of the conclusion", "Causal or absolute language needs examination in context; the phrase alone does not establish an error.", "Compare this claim with the design, assumptions and evidence. Qualify the claim if the design cannot support it.", /\b(caus\w*|proves?|guarantees?)\b/i);
  missing("citations", /\b(references|bibliography|works cited)\b/i, "Locate the reference list", "Provide the reference list and reconcile each in-text citation with the corresponding source.");
  add("citations", "Verify cited evidence independently", "Text screening cannot confirm that a publication exists or supports the claim.", "Use Evidence Atlas and original full texts to check source identity, claim support and retraction status.", /10\.\d{4,9}\/\S+|\([A-Z][^\n)]{0,70}\b(?:19|20)\d{2}[a-z]?\)/);
  missing("ethics", /\b(ethic\w*|consent|institutional review|approval|exempt\w*)\b/i, "Document ethical review or applicability", "State the relevant approval, consent or exemption, or explain why review is not applicable. Never invent an approval number.");
  missing("ethics", /\b(conflict\w* of interest|competing interests?|funding|funded|no external support)\b/i, "Check funding and competing-interest disclosures", "Add accurate funding and competing-interest statements appropriate to the target journal.");
  missing("reproducibility", /\b(data availability|code availability|repository|supplementary|protocol|search strings?)\b/i, "Explain how the work can be checked", "Describe data/code/material availability or justified access restrictions; include procedures or a search protocol appropriate to this manuscript.");
  missing("novelty", /\b(contribution|gap|novel\w*|extends?|prior work|previous studies)\b/i, "State the intended contribution", "Explain the specific contribution relative to relevant prior work, and verify it through a literature search.");
  add("novelty", "Confirm originality through literature comparison", "Novelty cannot be established from a manuscript alone.", "Compare the contribution with recent and foundational sources in Evidence Atlas; document both overlaps and differences.");
  missing("writing", /\blimitation\w*\b/i, "Make limitations visible", "Explain the limits of the design, evidence and generalisability; for an excerpt, check the full manuscript first.");
  const long = paragraphs.find(p => p.text.split(/\s+/).length > 180);
  if (long) findings.push({ id: "screening-writing-long", reviewer: "writing", priority: "minor", title: "Consider splitting a long paragraph", explanation: "This paragraph exceeds 180 words; that is a readability prompt, not a quality verdict.", action: "Separate distinct ideas while preserving quotations, citations and meaning.", evidence: { paragraph: long.number, quote: long.text.slice(0, 350) }, origin: "screening" });
  return { version: 1, title: input.title || "Untitled manuscript", kind: input.kind, scope: input.scope, generatedAt: new Date().toISOString(), wordCount: input.text.split(/\s+/).length, paragraphCount: paragraphs.length, mode: "screening", findings, overview: reviewOverview(findings), notices: ["Basic screening uses fixed text rules, not AI reviewers. No score or acceptance prediction is calculated.", REVIEW_NOTICE, ...(input.scope === "excerpt" ? ["Only the supplied excerpt was screened. Missing material may be present in another section."] : [])] };
}

/** Accept only schema-conforming findings with a verbatim manuscript anchor. */
export function parseAiFindings(raw: string, text: string): { findings: ReviewFinding[]; rejected: number } {
  const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length > 40) throw new Error("Invalid review format");
  const paragraphs = manuscriptParagraphs(text);
  const findings: ReviewFinding[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (const item of parsed.findings) {
    const p = item && paragraphs.find(p => p.number === item.paragraph);
    if (!item || !REVIEWERS.some(r => r.id === item.reviewer) || !["major", "minor", "question"].includes(item.priority)
      || !["title", "explanation", "action", "quote"].every(key => typeof item[key] === "string" && item[key].trim().length > 0)
      || item.title.length > 180 || item.explanation.length > 1500 || item.action.length > 1000
      || item.quote.length < 15 || item.quote.length > 600 || !p?.text.includes(item.quote)) { rejected++; continue; }
    const key = `${item.reviewer}:${item.quote}:${item.title.toLowerCase()}`;
    if (seen.has(key)) { rejected++; continue; }
    seen.add(key);
    findings.push({ id: `ai-${findings.length + 1}`, reviewer: item.reviewer, priority: item.priority, title: item.title.trim(), explanation: item.explanation.trim(), action: item.action.trim(), evidence: { paragraph: p.number, quote: item.quote }, origin: "ai" });
  }
  return { findings, rejected };
}

export function reviewMarkdown(report: ReviewReport, resolved: string[] = []) {
  return [`# Manuscript review: ${report.title}`, `Generated: ${report.generatedAt}`, `Mode: ${report.mode}${report.provider ? ` (${report.provider} / ${report.model})` : ""}. Scope: ${report.scope}. Type: ${report.kind}.`, "## Editor overview", report.overview, ...report.notices,
    ...REVIEWERS.flatMap(r => [`## ${r.name}`, ...report.findings.filter(f => f.reviewer === r.id).map(f => `### ${f.title}\nPriority: ${f.priority}; origin: ${f.origin}; author status: ${resolved.includes(f.id) ? "addressed (not independently verified)" : "open"}\n${f.explanation}\n${f.evidence ? `Paragraph ${f.evidence.paragraph}: “${f.evidence.quote}”` : "Evidence: reporting check only; no quoted passage."}\nNext action: ${f.action}`), ...(!report.findings.some(f => f.reviewer === r.id) ? ["No finding from this pass. This does not certify this area."] : [])])].join("\n\n");
}
