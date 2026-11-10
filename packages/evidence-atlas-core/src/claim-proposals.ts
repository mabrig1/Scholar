/**
 * Deterministic, abstract-anchored claim candidates.
 *
 * Candidate extraction does NOT establish validity, evidentiary stance,
 * methodological rigor, or scientific consensus. No model calls or data sharing.
 * This package stays independent of Scholar and external provider APIs.
 */
import { addAtlasClaim, type AtlasPaper, type AtlasProject } from "./index";

export type ClaimProposal = {
  id: string;
  paperId: string;
  doi: string;
  claimText: string;
  excerpt: string;
  start: number;
  end: number;
  signal: "possible-result-statement" | "context-statement";
  caution: string;
};

const OUTCOME_TERMS = /\b(?:result(?:s)?|found|finding(?:s)?|observ(?:ed|ation)|report(?:ed|s)?|show(?:s|ed|n)?|indicat(?:e|es|ed)|reveal(?:s|ed)?|associat(?:ed|ion)|correlat(?:ed|ion)|significan(?:t|ce)|effect(?:s)?|impact(?:s)?|increase(?:d|s)?|decrease(?:d|s)?|predict(?:ed|s)?|suggest(?:s|ed)?|higher|lower|no difference|no association)\b/i;

function sentenceRanges(abstract: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  // A punctuation boundary followed by whitespace + an uppercase word is
  // intentionally conservative; punctuation stays inside the source span.
  const boundary = /[.!?]\s+(?=[A-Z(])/g;
  let start = 0;
  for (const match of abstract.matchAll(boundary)) {
    const end = (match.index ?? 0) + 1;
    if (end > start) ranges.push([start, end]);
    start = (match.index ?? 0) + match[0].length;
  }
  if (start < abstract.length) ranges.push([start, abstract.length]);
  return ranges;
}

export function proposeAbstractClaims(paper: AtlasPaper, limit = 6): ClaimProposal[] {
  const abstract = paper.abstract || "";
  if (!abstract.trim() || abstract.length > 4000 || !paper.id || !paper.doi) return [];
  const max = Math.max(0, Math.min(12, Math.floor(limit)));
  const proposals: ClaimProposal[] = [];

  for (const [rawStart, rawEnd] of sentenceRanges(abstract)) {
    let start = rawStart;
    let end = rawEnd;
    while (start < end && /\s/.test(abstract[start])) start += 1;
    while (end > start && /\s/.test(abstract[end - 1])) end -= 1;
    const excerpt = abstract.slice(start, end);
    if (excerpt.length < 35 || excerpt.length > 450) continue;
    const words = excerpt.split(/\s+/).filter(Boolean);
    if (words.length < 6) continue;

    const signal: ClaimProposal["signal"] = OUTCOME_TERMS.test(excerpt)
      ? "possible-result-statement" : "context-statement";

    proposals.push({
      id: paper.id + ":" + start + "-" + end,
      paperId: paper.id,
      doi: paper.doi,
      claimText: excerpt,
      excerpt,
      start,
      end,
      signal,
      caution: signal === "possible-result-statement"
        ? "Keyword match only: inspect the full paper before treating this as a finding."
        : "Context sentence only: it may be background, a hypothesis, or a prior citation.",
    });
  }
  // Prefer potentially relevant sentences, but preserve source positions and
  // never rewrite a paper's wording or fabricate extractive quotations.
  return proposals.sort((a, b) =>
    Number(b.signal === "possible-result-statement") - Number(a.signal === "possible-result-statement") ||
    a.start - b.start).slice(0, max);
}

export function validateGroundedProposal(project: AtlasProject, proposal: ClaimProposal): AtlasPaper {
  const paper = project.papers.find((item) => item.id === proposal.paperId && item.doi === proposal.doi);
  if (!paper) throw new Error("The proposal's source paper is no longer in this project.");
  if (!Number.isInteger(proposal.start) || !Number.isInteger(proposal.end) ||
      proposal.start < 0 || proposal.end > paper.abstract.length || proposal.end <= proposal.start) {
    throw new Error("Invalid source excerpt range.");
  }
  const originalText = paper.abstract.slice(proposal.start, proposal.end);
  if (originalText !== proposal.excerpt || originalText !== proposal.claimText || originalText.length < 35) {
    throw new Error("Proposal is not an exact excerpt of the saved source abstract.");
  }
  if (proposal.id !== paper.id + ":" + proposal.start + "-" + proposal.end) {
    throw new Error("Proposal identity does not match its source range.");
  }
  return paper;
}

export function approveGroundedProposal(project: AtlasProject, proposal: ClaimProposal): AtlasProject {
  const paper = validateGroundedProposal(project, proposal);
  // Approval adds a researcher-selected proposition. It deliberately does not
  // record supporting evidence or a full-text claim, or update consensus counts.
  const updated = addAtlasClaim(project, proposal.claimText);
  if (updated === project) return project;
  const claims = updated.claims.map((claim) => claim.text === proposal.claimText ? {
    ...claim,
    origin: {
      paperId: paper.id,
      doi: paper.doi,
      excerpt: proposal.excerpt,
      locator: "Abstract",
      start: proposal.start,
      end: proposal.end,
      reviewStatus: "proposal-approved" as const,
    },
  } : claim);
  return {
    ...updated,
    claims,
    events: [...updated.events.slice(-248), {
      id: globalThis.crypto.randomUUID(),
      at: new Date().toISOString(),
      action: "grounded-claim-approved",
      summary: "Researcher approved an abstract-excerpt proposition from DOI " + paper.doi + "; no evidence classification created.",
    }],
  };
}
