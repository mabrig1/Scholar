import { normalizeOpenAlexSource, type Journal } from "@/lib/journals";

export type HighImpactInput = {
  clientName: string;
  title: string;
  abstract: string;
  field: string;
  articleType: string;
  studyDesign: string;
  noveltyClaim: string;
  mainFinding: string;
  methodsSummary: string;
  manuscriptText: string;
  targetJournals: string[];
  authorCountry: string;
  fundingStatus: string;
};

export type ReportingGuideline = {
  name: string;
  reason: string;
  officialUrl: string;
};

export type HighImpactDimension = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: "strong" | "developing" | "critical";
  actions: string[];
};

export type RelatedWork = {
  id: string;
  title: string;
  year: number | null;
  citedByCount: number;
  journal: string | null;
  doi: string | null;
};

export type JournalDueDiligence = {
  query: string;
  matchedName: string | null;
  publisher: string | null;
  issn: string[];
  homepage: string | null;
  openAlexEvidence: boolean;
  crossrefEvidence: boolean;
  doajSignal: boolean;
  isOpenAccess: boolean;
  apcUsd: number | null;
  feeStatus: Journal["feeStatus"] | "unknown";
  hIndex: number | null;
  twoYearMeanCitedness: number | null;
  evidenceStatus: "verified-evidence" | "registry-evidence" | "caution";
  cautions: string[];
};

export type HighImpactAssessment = {
  score: number;
  verdict: "HIGH-IMPACT READY" | "COMPETITIVE AFTER REVISION" | "UPGRADE BEFORE TARGETING TOP JOURNALS";
  dimensions: HighImpactDimension[];
  reportingGuidelines: ReportingGuideline[];
  deskRejectionRisks: string[];
  editorialHooks: string[];
  scamShieldRules: string[];
};

const lower = (value: string) => value.toLowerCase();
const hasAny = (text: string, terms: string[]) => terms.some((term) => lower(text).includes(term));
const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export function reportingGuidelinesFor(studyDesign: string, articleType: string): ReportingGuideline[] {
  const text = lower(`${studyDesign} ${articleType}`);
  const out: ReportingGuideline[] = [];
  const add = (name: string, reason: string, officialUrl: string) => {
    if (!out.some((item) => item.name === name)) out.push({ name, reason, officialUrl });
  };

  if (/(random|trial|rct|controlled trial)/.test(text)) add("CONSORT", "Randomized trials should be reported against the CONSORT checklist and flow diagram.", "https://www.consort-statement.org/");
  if (/(systematic|meta-analysis|meta analysis)/.test(text)) add("PRISMA", "Systematic reviews and meta-analyses should report transparent search, selection and synthesis methods.", "https://www.prisma-statement.org/");
  if (/(observational|cross-sectional|cross sectional|cohort|case-control|case control|survey)/.test(text)) add("STROBE", "Observational studies should report design, participants, variables, bias and analyses transparently.", "https://www.strobe-statement.org/");
  if (/(diagnostic|diagnosis|accuracy)/.test(text)) add("STARD", "Diagnostic-accuracy studies should follow STARD reporting requirements.", "https://www.equator-network.org/reporting-guidelines/stard/");
  if (/(qualitative|interview|focus group|phenomenolog|ethnograph)/.test(text)) add("COREQ / SRQR", "Qualitative studies need transparent sampling, researcher-role, analysis and reporting detail.", "https://www.equator-network.org/reporting-guidelines/coreq/");
  if (/(case report|case study)/.test(text)) add("CARE", "Clinical case reports should follow CARE reporting guidance.", "https://www.care-statement.org/");
  if (/(animal|preclinical|pre-clinical)/.test(text)) add("ARRIVE", "Animal and preclinical studies should follow ARRIVE reporting guidance.", "https://arriveguidelines.org/");
  if (/(protocol)/.test(text)) add("SPIRIT / PRISMA-P", "Study and review protocols require protocol-specific reporting standards.", "https://www.equator-network.org/");
  if (/(economic evaluation|cost effectiveness|cost-effectiveness)/.test(text)) add("CHEERS", "Economic evaluations should report methods and outcomes using CHEERS.", "https://www.equator-network.org/reporting-guidelines/cheers/");
  if (!out.length) add("EQUATOR guideline finder", "Select the reporting guideline that matches the study design before targeting selective journals.", "https://www.equator-network.org/reporting-guidelines/");
  return out;
}

export function assessHighImpactReadiness(input: HighImpactInput): HighImpactAssessment {
  const all = `${input.title}\n${input.abstract}\n${input.methodsSummary}\n${input.manuscriptText}`;
  const abstractWords = words(input.abstract);
  const titleWords = words(input.title);
  const manuscriptWords = words(input.manuscriptText);

  const noveltyScore = Math.min(20,
    (words(input.noveltyClaim) >= 18 ? 8 : words(input.noveltyClaim) >= 8 ? 4 : 1) +
    (words(input.mainFinding) >= 15 ? 6 : words(input.mainFinding) >= 7 ? 3 : 1) +
    (hasAny(all, ["novel", "first", "gap", "unexplored", "understudied", "new evidence", "contribution"]) ? 3 : 0) +
    (hasAny(all, ["implication", "policy", "practice", "mechanism", "theory"]) ? 3 : 0)
  );

  const methodsScore = Math.min(20,
    (words(input.methodsSummary) >= 55 ? 8 : words(input.methodsSummary) >= 25 ? 5 : 2) +
    (hasAny(all, ["sample", "participants", "population", "dataset", "data source"]) ? 3 : 0) +
    (hasAny(all, ["analysis", "regression", "thematic", "model", "confidence interval", "standard deviation", "effect size", "chi-square", "anova", "correlation"]) ? 4 : 0) +
    (hasAny(all, ["ethics", "consent", "approval", "institutional review", "irb"]) ? 2 : 0) +
    (hasAny(all, ["limitation", "bias", "robustness", "sensitivity", "validity", "reliability"]) ? 3 : 0)
  );

  const reporting = reportingGuidelinesFor(input.studyDesign, input.articleType);
  const reportingScore = Math.min(15,
    (input.studyDesign.trim() ? 5 : 1) +
    (hasAny(all, ["method", "results", "discussion", "conclusion"]) ? 4 : 1) +
    (hasAny(all, ["data availability", "funding", "conflict of interest", "author contribution", "ethics statement"]) ? 3 : 0) +
    (manuscriptWords >= 1000 ? 3 : manuscriptWords >= 300 ? 2 : 0)
  );

  const abstractScore = Math.min(15,
    (titleWords >= 6 && titleWords <= 22 ? 4 : titleWords > 0 ? 2 : 0) +
    (abstractWords >= 140 && abstractWords <= 350 ? 5 : abstractWords >= 80 ? 3 : 1) +
    (hasAny(input.abstract, ["method", "design", "sample", "data"]) ? 2 : 0) +
    (hasAny(input.abstract, ["result", "finding", "%", "significant", "effect"]) ? 2 : 0) +
    (hasAny(input.abstract, ["conclusion", "implication", "suggest", "recommend"]) ? 2 : 0)
  );

  const journalScore = Math.min(15,
    (input.targetJournals.length >= 2 ? 5 : input.targetJournals.length === 1 ? 3 : 0) +
    (input.field.trim() ? 3 : 0) +
    (input.noveltyClaim.trim() ? 3 : 0) +
    (input.mainFinding.trim() ? 2 : 0) +
    (input.authorCountry.trim() ? 1 : 0) +
    (input.fundingStatus.trim() ? 1 : 0)
  );

  const ethicsScore = Math.min(10,
    (hasAny(all, ["ethics", "consent", "approval", "exempt"]) ? 3 : 0) +
    (hasAny(all, ["conflict of interest", "competing interest"]) ? 2 : 0) +
    (hasAny(all, ["funding", "financial support"]) ? 2 : 0) +
    (hasAny(all, ["data availability", "data statement", "repository"]) ? 2 : 0) +
    (hasAny(all, ["author contribution", "credit taxonomy", "crédiT"]) ? 1 : 0)
  );

  const visibilityScore = Math.min(5,
    (hasAny(all, ["doi", "orcid"]) ? 2 : 0) +
    (hasAny(all, ["keyword", "key words"]) ? 1 : 0) +
    (hasAny(all, ["data availability", "repository", "supplementary"]) ? 1 : 0) +
    (input.title.trim() && input.abstract.trim() ? 1 : 0)
  );

  const make = (id: string, label: string, score: number, maxScore: number, actions: string[]): HighImpactDimension => ({
    id,
    label,
    score,
    maxScore,
    status: score / maxScore >= .75 ? "strong" : score / maxScore >= .5 ? "developing" : "critical",
    actions,
  });

  const dimensions = [
    make("novelty", "Novelty, significance & editorial value", noveltyScore, 20, ["State the research gap in one sentence.", "State what changes because of this study—not merely what was measured.", "Connect the contribution to a live scientific, policy, clinical or theoretical problem."]),
    make("methods", "Methods, evidence & statistical credibility", methodsScore, 20, ["Make sampling/data source and analytic decisions auditable.", "Report uncertainty/effect sizes where appropriate, not only significance labels.", "State limitations, bias controls and robustness checks honestly."]),
    make("reporting", "Reporting-guideline & manuscript completeness", reportingScore, 15, ["Complete the study-design reporting checklist before submission.", "Add required ethics, funding, data and contribution statements.", "Make figures/tables/results traceable to methods and research questions."]),
    make("abstract", "Title, abstract & editor-facing clarity", abstractScore, 15, ["Make the title specific, searchable and free of inflated claims.", "Make the abstract carry methods, actual results and implications.", "Remove generic background sentences that consume abstract space without advancing the contribution."]),
    make("journal", "Journal strategy & evidence-based targeting", journalScore, 15, ["Use at least one ambitious target plus realistic backups.", "Confirm recent papers in each journal are genuinely close to the manuscript topic/design.", "Verify official indexing/metrics/fees before any payment or submission."]),
    make("ethics", "Ethics, transparency & trust", ethicsScore, 10, ["Add all applicable ethics/consent statements.", "Declare funding and competing interests explicitly.", "Add data-availability and author-contribution statements where required."]),
    make("visibility", "Discoverability & research identity", visibilityScore, 5, ["Align title, keywords, author names and ORCID across submission metadata.", "Prepare DOI/repository/Scholar visibility only after legitimate publication."]),
  ];

  const score = dimensions.reduce((sum, item) => sum + item.score, 0);
  const verdict = score >= 80 ? "HIGH-IMPACT READY" : score >= 60 ? "COMPETITIVE AFTER REVISION" : "UPGRADE BEFORE TARGETING TOP JOURNALS";

  const deskRejectionRisks: string[] = [];
  if (noveltyScore < 14) deskRejectionRisks.push("The contribution may read as incremental because the novelty/significance claim is not yet sharp enough.");
  if (methodsScore < 14) deskRejectionRisks.push("Methods/evidence detail may be insufficient for a selective editor to judge credibility quickly.");
  if (abstractScore < 11) deskRejectionRisks.push("The title/abstract may not communicate a strong result and editorial reason to send the paper for review.");
  if (reportingScore < 11) deskRejectionRisks.push("Reporting or declaration gaps could trigger technical return or desk rejection before peer review.");
  if (!input.targetJournals.length) deskRejectionRisks.push("No target-journal ladder exists yet; scope mismatch is a major avoidable cause of rejection.");
  if (!input.noveltyClaim.trim()) deskRejectionRisks.push("No explicit novelty claim was supplied.");
  if (!input.mainFinding.trim()) deskRejectionRisks.push("No concise main finding was supplied.");

  const editorialHooks = [
    input.noveltyClaim.trim() || "Define the specific knowledge gap this manuscript closes.",
    input.mainFinding.trim() || "State the single result an editor should remember after reading the abstract.",
    input.field.trim() ? `Explain why this result matters now in ${input.field}.` : "Explain why this result matters now to the field.",
  ];

  return {
    score,
    verdict,
    dimensions,
    reportingGuidelines: reporting,
    deskRejectionRisks,
    editorialHooks,
    scamShieldRules: [
      "Never pay a publication fee from a WhatsApp, Gmail or personal bank-account instruction without matching it to the official publisher/journal workflow.",
      "Never treat an emailed 'Impact Factor' certificate, GIF, badge or screenshot as authoritative evidence of Journal Impact Factor, Scopus, Web of Science or other indexing.",
      "Verify journal title, ISSN, publisher identity, official domain, editorial policies and current fees independently before submission.",
      "Use licensed Clarivate/Scopus sources when a proprietary JIF/quartile/indexing claim is commercially important; Researcher Pro must not manufacture those values.",
      "A Crossref DOI or Google Scholar appearance alone does not prove that a journal is reputable.",
    ],
  };
}

async function fetchOpenAlexSource(query: string): Promise<Journal | null> {
  const url = new URL("https://api.openalex.org/sources");
  url.searchParams.set("search", query);
  url.searchParams.set("filter", "type:journal");
  url.searchParams.set("per-page", "5");
  if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "MabrigResearcherPro/0.8 (high impact accelerator)" }, next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const data = await response.json();
    const journals = (data.results ?? []).map(normalizeOpenAlexSource) as Journal[];
    const q = lower(query).replace(/[^a-z0-9]+/g, " ").trim();
    return journals.find((item) => lower(item.name).replace(/[^a-z0-9]+/g, " ").trim() === q) ?? journals[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchCrossrefJournal(query: string) {
  const url = new URL("https://api.crossref.org/journals");
  url.searchParams.set("query", query);
  url.searchParams.set("rows", "5");
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": `MabrigResearcherPro/0.8 (${process.env.CROSSREF_MAILTO ? `mailto:${process.env.CROSSREF_MAILTO}` : "journal verification"})` },
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const items = data.message?.items ?? [];
    const q = lower(query).replace(/[^a-z0-9]+/g, " ").trim();
    return items.find((item: any) => lower(String(item.title ?? "")).replace(/[^a-z0-9]+/g, " ").trim() === q) ?? items[0] ?? null;
  } catch {
    return null;
  }
}

export async function verifyTargetJournals(targets: string[]): Promise<JournalDueDiligence[]> {
  return Promise.all(targets.slice(0, 6).map(async (query) => {
    const [oa, cr] = await Promise.all([fetchOpenAlexSource(query), fetchCrossrefJournal(query)]);
    const crossrefIssn = Array.isArray(cr?.ISSN) ? cr.ISSN.map(String) : [];
    const cautions: string[] = [];
    if (!oa) cautions.push("No OpenAlex source match was resolved from this title; inspect the exact ISSN and publisher domain manually.");
    if (!cr) cautions.push("No Crossref journal-title result was resolved; confirm DOI-registration evidence manually.");
    if (oa && !oa.isInDoaj && oa.isOpenAccess) cautions.push("Open-access signal is present but DOAJ inclusion was not returned by OpenAlex; this is not proof of a problem, but merits manual verification.");
    if (!oa?.apcUsd && oa?.feeStatus === "unknown") cautions.push("APC/fee status is unknown. Verify the current official author-fee page before quoting a client.");
    cautions.push("Official Journal Impact Factor, JCR quartile, Scopus percentile/quartile and Web of Science indexing are not inferred here; verify those claims from licensed/official sources.");
    const openAlexEvidence = Boolean(oa);
    const crossrefEvidence = Boolean(cr);
    const evidenceStatus = openAlexEvidence && crossrefEvidence ? "verified-evidence" : openAlexEvidence || crossrefEvidence ? "registry-evidence" : "caution";
    return {
      query,
      matchedName: oa?.name ?? cr?.title ?? null,
      publisher: oa?.publisher ?? cr?.publisher ?? null,
      issn: oa?.issn?.length ? oa.issn : crossrefIssn,
      homepage: oa?.homepage ?? null,
      openAlexEvidence,
      crossrefEvidence,
      doajSignal: Boolean(oa?.isInDoaj),
      isOpenAccess: Boolean(oa?.isOpenAccess),
      apcUsd: oa?.apcUsd ?? null,
      feeStatus: oa?.feeStatus ?? "unknown",
      hIndex: oa?.hIndex ?? null,
      twoYearMeanCitedness: oa?.twoYearMeanCitedness ?? null,
      evidenceStatus,
      cautions,
    } satisfies JournalDueDiligence;
  }));
}

export async function fetchRelatedHighSignalWork(searchText: string): Promise<RelatedWork[]> {
  if (!searchText.trim()) return [];
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", searchText.slice(0, 500));
  url.searchParams.set("filter", "type:article");
  url.searchParams.set("per-page", "30");
  if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "MabrigResearcherPro/0.8 (high impact literature landscape)" }, next: { revalidate: 3600 } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results ?? [])
      .map((work: any): RelatedWork => ({
        id: String(work.id ?? crypto.randomUUID()),
        title: String(work.display_name ?? work.title ?? "Untitled work"),
        year: typeof work.publication_year === "number" ? work.publication_year : null,
        citedByCount: typeof work.cited_by_count === "number" ? work.cited_by_count : 0,
        journal: work.primary_location?.source?.display_name ?? null,
        doi: typeof work.doi === "string" ? work.doi.replace(/^https?:\/\/doi\.org\//i, "") : null,
      }))
      .sort((a: RelatedWork, b: RelatedWork) => b.citedByCount - a.citedByCount)
      .slice(0, 12);
  } catch {
    return [];
  }
}
