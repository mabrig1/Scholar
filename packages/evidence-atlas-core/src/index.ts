/**
 * Evidence Atlas domain model v1.
 * Pure, browser/server compatible and independent of Scholar auth, payments and DB.
 * Facts about paper metadata do not constitute verified findings.
 */
import { isValidMethodAppraisal } from "./method-appraisal";
import { validObjective } from "./objective-alignment";
import type { AtlasObjective } from "./objective-alignment";
import type { AtlasMethodAppraisal } from "./method-appraisal";

export const ATLAS_STORAGE_KEY = "mabrig_evidence_atlas_v1";
export const ATLAS_SCHEMA_VERSION = 1;

export type EvidenceStance = "supports" | "contradicts" | "mixed" | "unclear";
export type EvidenceBasis = "abstract" | "full-text";
export type AtlasPaper = {
  id: string;
  doi: string;
  title: string;
  year: number;
  journal: string;
  authors: string[];
  abstract: string;
  verification: "crossref" | "crossref-openalex";
  retracted: boolean;
};
export type AtlasClaimOrigin = {
  paperId: string;
  doi: string;
  excerpt: string;
  locator: "Abstract";
  start: number;
  end: number;
  reviewStatus: "proposal-approved";
};
export type AtlasClaim = {
  id: string;
  text: string;
  createdAt: string;
  /** Optional, human-approved exact abstract passage; NOT reviewed evidence. */
  origin?: AtlasClaimOrigin;
};
export type AtlasEvidence = {
  id: string;
  claimId: string;
  paperId: string;
  stance: EvidenceStance;
  basis: EvidenceBasis;
  excerpt: string;
  locator: string;
  notes: string;
  reviewedAt: string;
  /** Optional, reviewer-transcribed context. Never an automatic quality score. */
  appraisal?: AtlasMethodAppraisal;
};
export type AtlasEvent = { id: string; at: string; action: string; summary: string };
export type AtlasProject = {
  version: 1;
  id: string;
  title: string;
  question: string;
  createdAt: string;
  updatedAt: string;
  papers: AtlasPaper[];
  claims: AtlasClaim[];
  evidence: AtlasEvidence[];
  /** Researcher-authored objective alignment; optional on historic v1 backups. */
  objectives: AtlasObjective[];
  events: AtlasEvent[];
};
export type SearchArticle = {
  doi: string;
  title: string;
  year: number;
  journal: string;
  authors: Array<{ given: string; family: string }>;
  abstract: string;
  verification: "crossref" | "crossref-openalex";
  retracted: boolean;
};
export type ClaimSummary = Record<EvidenceStance, number> & { total: number; abstractOnly: number };

function identifier() {
  return globalThis.crypto.randomUUID();
}
function now() {
  return new Date().toISOString();
}
function limited(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function event(action: string, summary: string): AtlasEvent {
  return { id: identifier(), at: now(), action, summary: limited(summary, 300) };
}
function evolve(project: AtlasProject, change: Partial<AtlasProject>, action: string, summary: string): AtlasProject {
  return {
    ...project,
    ...change,
    updatedAt: now(),
    events: [...project.events.slice(-248), event(action, summary)],
  };
}
export function createAtlasProject(title: string, question: string): AtlasProject {
  const cleanTitle = limited(title, 180);
  const cleanQuestion = limited(question, 600);
  if (cleanTitle.length < 4 || cleanQuestion.length < 8) {
    throw new Error("Add a project title (4+ characters) and research question (8+ characters).");
  }
  const timestamp = now();
  return {
    version: 1,
    id: identifier(),
    title: cleanTitle,
    question: cleanQuestion,
    createdAt: timestamp,
    updatedAt: timestamp,
    papers: [],
    claims: [],
    evidence: [],
    objectives: [],
    events: [event("project-created", "Created evidence map: " + cleanTitle)],
  };
}
export function addAtlasPaper(project: AtlasProject, article: SearchArticle): AtlasProject {
  const doi = limited(article.doi, 250).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
  if (!/^10\.\d{4,9}\/\S+$/i.test(doi) || !limited(article.title, 600)) {
    throw new Error("Only articles with a valid DOI and title can be saved.");
  }
  if (project.papers.some((p) => p.doi === doi)) return project;
  if (project.papers.length >= 50) throw new Error("This early-access map supports up to 50 papers.");
  const paper: AtlasPaper = {
    id: identifier(),
    doi,
    title: limited(article.title, 500),
    year: Number.isInteger(article.year) && article.year >= 1600 && article.year <= new Date().getFullYear() + 1 ? article.year : 0,
    journal: limited(article.journal, 200),
    authors: Array.isArray(article.authors) ? article.authors.slice(0, 30).map((a) => limited((a.given || "") + " " + (a.family || ""), 100)).filter(Boolean) : [],
    abstract: limited(article.abstract, 4_000),
    verification: article.verification === "crossref-openalex" ? "crossref-openalex" : "crossref",
    retracted: Boolean(article.retracted),
  };
  return evolve(project, { papers: [...project.papers, paper] }, "paper-saved", "Saved DOI " + doi + (paper.retracted ? " (retraction flag present)" : ""));
}
export function addAtlasClaim(project: AtlasProject, text: string): AtlasProject {
  const clean = limited(text, 500);
  if (clean.length < 12) throw new Error("Write a precise claim (at least 12 characters).");
  if (project.claims.some((c) => c.text.toLowerCase() === clean.toLowerCase())) return project;
  if (project.claims.length >= 40) throw new Error("This early-access map supports up to 40 claims.");
  return evolve(project, {
    claims: [...project.claims, { id: identifier(), text: clean, createdAt: now() }],
  }, "claim-added", clean);
}
export function recordAtlasEvidence(project: AtlasProject, input: {
  claimId: string;
  paperId: string;
  stance: EvidenceStance;
  basis: EvidenceBasis;
  excerpt: string;
  locator: string;
  notes: string;
}): AtlasProject {
  if (!project.claims.some((c) => c.id === input.claimId) || !project.papers.some((p) => p.id === input.paperId)) {
    throw new Error("Select a claim and a saved source paper.");
  }
  if (!["supports", "contradicts", "mixed", "unclear"].includes(input.stance)) throw new Error("Invalid evidence classification.");
  if (!["abstract", "full-text"].includes(input.basis)) throw new Error("Specify whether you reviewed an abstract or full text.");
  const excerpt = limited(input.excerpt, 1500);
  if (excerpt.length < 12) throw new Error("Enter an identifiable source excerpt (12+ characters).");
  const previous = project.evidence.find((e) => e.claimId === input.claimId && e.paperId === input.paperId);
  if (!previous && project.evidence.length >= 300) throw new Error("This map supports up to 300 assessments.");
  const assessment: AtlasEvidence = {
    id: previous?.id || identifier(),
    claimId: input.claimId,
    paperId: input.paperId,
    stance: input.stance,
    basis: input.basis,
    excerpt,
    locator: limited(input.locator, 120),
    notes: limited(input.notes, 1200),
    reviewedAt: now(),
    // Reclassification against a changed passage invalidates previous methods context.
    // Otherwise keep an independent methodological appraisal linked to this exact review.
    ...(previous?.appraisal &&
      previous.basis === input.basis && previous.stance === input.stance &&
      previous.excerpt === excerpt && previous.locator === limited(input.locator, 120)
        ? { appraisal: previous.appraisal }
        : {}),
  };
  const evidence = previous
    ? project.evidence.map((item) => item.id === previous.id ? assessment : item)
    : [...project.evidence, assessment];
  return evolve(project, { evidence }, previous ? "assessment-revised" : "assessment-recorded",
    "Researcher classified " + input.stance + " evidence from DOI " + project.papers.find((p) => p.id === input.paperId)?.doi);
}
export function logAtlasSearch(project: AtlasProject, query: string, count: number): AtlasProject {
  return evolve(project, {}, "search", "Crossref search: " + limited(query, 180) + "; " + count + " results returned.");
}
export function summarizeAtlasClaim(project: AtlasProject, claimId: string): ClaimSummary {
  const result: ClaimSummary = { supports: 0, contradicts: 0, mixed: 0, unclear: 0, total: 0, abstractOnly: 0 };
  for (const item of project.evidence) {
    if (item.claimId !== claimId) continue;
    result[item.stance] += 1;
    result.total += 1;
    if (item.basis === "abstract") result.abstractOnly += 1;
  }
  return result;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/** Strict validation at the import boundary; never trust JSON copied from another browser. */
export function parseAtlasProject(raw: unknown): AtlasProject {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.id !== "string" ||
      typeof raw.title !== "string" || typeof raw.question !== "string" ||
      !Array.isArray(raw.papers) || !Array.isArray(raw.claims) ||
      !Array.isArray(raw.evidence) || !Array.isArray(raw.events) ||
      raw.papers.length > 50 || raw.claims.length > 40 || raw.evidence.length > 300 || raw.events.length > 250) {
    throw new Error("Invalid or unsupported Evidence Atlas project.");
  }
  const base = raw as unknown as AtlasProject;
  if (!base.title.trim() || !base.question.trim()) throw new Error("Project title and question are required.");
  if (!base.papers.every((p) => isRecord(p) && typeof p.id === "string" && typeof p.doi === "string" &&
    /^10\.\d{4,9}\/\S+$/i.test(p.doi) && typeof p.title === "string" &&
    typeof p.abstract === "string" && p.abstract.length <= 4_000 &&
    Array.isArray(p.authors) && p.authors.every((a) => typeof a === "string"))) {
    throw new Error("The project contains invalid paper records.");
  }
  if (!base.claims.every((c) => isRecord(c) && typeof c.id === "string" && typeof c.text === "string" && c.text.length <= 500)) {
    throw new Error("The project contains invalid claims.");
  }
  const claimIds = new Set(base.claims.map((c) => c.id));
  const paperIds = new Set(base.papers.map((p) => p.id));
  // Backwards compatibility: existing v1 project backups never had objective records.
  const objectives: unknown[] = raw.objectives === undefined ? [] :
    Array.isArray(raw.objectives) ? raw.objectives : [null];
  if (objectives.length > 12 || !objectives.every((objective) => validObjective(objective, claimIds)) ||
      new Set(objectives.map((x) => (x as AtlasObjective).id)).size !== objectives.length) {
    throw new Error("The project contains invalid or orphaned research objectives.");
  }
  const papersById = new Map(base.papers.map((p) => [p.id, p]));
  if (!base.claims.every((c) => {
    if (c.origin === undefined) return true;
    if (!isRecord(c.origin)) return false;
    const o = c.origin;
    const paper = papersById.get(o.paperId);
    return Boolean(paper) && o.doi === paper?.doi &&
      o.locator === "Abstract" && o.reviewStatus === "proposal-approved" &&
      Number.isInteger(o.start) && Number.isInteger(o.end) && o.start >= 0 &&
      o.end > o.start && o.end <= (paper?.abstract.length || 0) &&
      o.excerpt === paper?.abstract.slice(o.start, o.end) &&
      o.excerpt === c.text && o.excerpt.length >= 35 && o.excerpt.length <= 450;
  })) {
    throw new Error("The project contains invalid or tampered claim-proposal origins.");
  }
  if (claimIds.size !== base.claims.length || paperIds.size !== base.papers.length) {
    throw new Error("The project contains duplicate identifiers.");
  }
  if (!base.evidence.every((e) => isRecord(e) && typeof e.id === "string" &&
      claimIds.has(e.claimId) && paperIds.has(e.paperId) &&
      ["supports", "contradicts", "mixed", "unclear"].includes(e.stance) &&
      ["abstract", "full-text"].includes(e.basis) && typeof e.excerpt === "string" &&
      e.excerpt.trim().length >= 12 && e.excerpt.length <= 1500 &&
      typeof e.notes === "string" && e.notes.length <= 1200 &&
      typeof e.locator === "string" &&
      (e.appraisal === undefined || isValidMethodAppraisal(e.appraisal)))) {
    throw new Error("The project contains unsupported or orphaned evidence records.");
  }
  if (new Set(base.evidence.map((e) => e.claimId + ":" + e.paperId)).size !== base.evidence.length) {
    throw new Error("The project contains duplicate assessments.");
  }
  if (!base.events.every((e) => isRecord(e) && typeof e.id === "string" && typeof e.at === "string" &&
      typeof e.action === "string" && typeof e.summary === "string")) {
    throw new Error("The project contains invalid research history.");
  }
  return {
    version: 1,
    id: limited(base.id, 120),
    title: limited(base.title, 180),
    question: limited(base.question, 600),
    createdAt: limited(base.createdAt, 80),
    updatedAt: limited(base.updatedAt, 80),
    papers: base.papers,
    claims: base.claims,
    evidence: base.evidence,
    objectives: objectives as AtlasObjective[],
    events: base.events,
  };
}
