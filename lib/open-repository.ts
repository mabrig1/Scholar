import { createHash } from "crypto";

export type RepositoryWorkType =
  | "ARTICLE"
  | "THESIS"
  | "PREPRINT"
  | "CONFERENCE_PAPER"
  | "BOOK_CHAPTER"
  | "REPORT";

export type RepositorySubmissionInput = {
  fullName: string;
  affiliation: string;
  department?: string;
  contactEmail: string;
  orcid?: string;
  bio?: string;
  title: string;
  authors: string[];
  year: number;
  workType: RepositoryWorkType;
  abstract: string;
  keywords: string[];
  journal?: string;
  doi?: string;
  externalUrl?: string;
  license?: string;
  rightsStatement?: string;
  rightsConfirmed: boolean;
};

export type RepositoryReadiness = {
  score: number;
  readyForReview: boolean;
  blockers: string[];
  warnings: string[];
};

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeDoi(value: unknown) {
  return clean(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

export function normalizeOrcid(value: unknown) {
  return clean(value)
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .toUpperCase();
}

export function slugify(value: unknown, max = 70) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function researcherSlug(fullName: string, orcid = "") {
  const base = slugify(fullName, 56) || "researcher";
  const identity = normalizeOrcid(orcid) || clean(fullName).toLowerCase();
  const suffix = createHash("sha256").update(identity).digest("hex").slice(0, 7);
  return `${base}-${suffix}`;
}

export function workSlug(input: Pick<RepositorySubmissionInput, "title" | "authors" | "year">) {
  const base = slugify(input.title, 58) || "scholarly-work";
  const fingerprint = [clean(input.title).toLowerCase(), input.authors.map(clean).join("|").toLowerCase(), input.year].join("::");
  const suffix = createHash("sha256").update(fingerprint).digest("hex").slice(0, 8);
  return `${base}-${input.year}-${suffix}`;
}

export function assessRepositorySubmission(input: RepositorySubmissionInput): RepositoryReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (clean(input.fullName).length < 3) blockers.push("Researcher publishing name is required.");
  if (clean(input.affiliation).length < 2) blockers.push("Current affiliation or independent-researcher status is required.");
  if (!/^\S+@\S+\.\S+$/.test(clean(input.contactEmail))) blockers.push("A valid private contact email is required for moderation.");
  if (clean(input.title).length < 12) blockers.push("Provide the complete scholarly work title.");
  if (!input.authors.map(clean).filter(Boolean).length) blockers.push("At least one author is required.");
  if (!Number.isInteger(input.year) || input.year < 1500 || input.year > new Date().getFullYear() + 1) blockers.push("Publication year is invalid.");
  if (clean(input.abstract).length < 80) blockers.push("Provide a complete author-written abstract of at least 80 characters.");
  if (!input.rightsConfirmed) blockers.push("The depositor must confirm the right to make the submitted metadata/file publicly available.");
  if (!clean(input.rightsStatement)) warnings.push("Add a rights statement or publisher/self-archiving basis before approval.");
  if (!clean(input.license)) warnings.push("No reuse licence was supplied; the repository should display rights as reserved/unspecified.");
  if (!normalizeDoi(input.doi)) warnings.push("No DOI supplied. A DOI is helpful for record matching but is not mandatory.");
  if (!normalizeOrcid(input.orcid)) warnings.push("No ORCID supplied. ORCID is recommended for author disambiguation.");

  const max = 8;
  const complete = [
    clean(input.fullName).length >= 3,
    clean(input.affiliation).length >= 2,
    /^\S+@\S+\.\S+$/.test(clean(input.contactEmail)),
    clean(input.title).length >= 12,
    input.authors.map(clean).filter(Boolean).length > 0,
    Number.isInteger(input.year) && input.year >= 1500 && input.year <= new Date().getFullYear() + 1,
    clean(input.abstract).length >= 80,
    input.rightsConfirmed,
  ].filter(Boolean).length;

  return {
    score: Math.round((complete / max) * 100),
    readyForReview: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function buildRepositoryHighwireMeta(input: {
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  canonicalUrl: string;
  pdfUrl?: string;
}) {
  const tags: Record<string, string | string[]> = {
    citation_title: clean(input.title),
    citation_author: input.authors.map(clean).filter(Boolean),
    citation_publication_date: String(input.year),
    citation_abstract_html_url: input.canonicalUrl,
  };

  if (clean(input.journal)) tags.citation_journal_title = clean(input.journal);
  const doi = normalizeDoi(input.doi);
  if (doi) tags.citation_doi = doi;
  if (clean(input.pdfUrl)) tags.citation_pdf_url = clean(input.pdfUrl);

  return tags;
}

export function repositoryJsonLd(input: {
  title: string;
  authors: Array<{ name: string; orcid?: string }>;
  year: number;
  abstract: string;
  keywords: string[];
  journal?: string;
  doi?: string;
  canonicalUrl: string;
  pdfUrl?: string;
  license?: string;
}) {
  const doi = normalizeDoi(input.doi);
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: clean(input.title),
    author: input.authors.map((author) => ({
      "@type": "Person",
      name: clean(author.name),
      ...(normalizeOrcid(author.orcid) ? { sameAs: `https://orcid.org/${normalizeOrcid(author.orcid)}` } : {}),
    })),
    datePublished: String(input.year),
    abstract: clean(input.abstract),
    keywords: input.keywords.map(clean).filter(Boolean),
    url: input.canonicalUrl,
    ...(clean(input.journal) ? { isPartOf: { "@type": "Periodical", name: clean(input.journal) } } : {}),
    ...(doi ? { identifier: `https://doi.org/${doi}` } : {}),
    ...(clean(input.pdfUrl)
      ? { encoding: { "@type": "MediaObject", contentUrl: clean(input.pdfUrl), encodingFormat: "application/pdf" } }
      : {}),
    ...(clean(input.license) ? { license: clean(input.license) } : {}),
  };
}

export function parseList(value: unknown, limit = 20) {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map(clean)
    .filter(Boolean)
    .slice(0, limit);
}
