/**
 * JournalGuard claim-level evidence schema v1.
 *
 * A valid format or an authoritative metadata lookup supports only that narrow
 * proposition. It never establishes editorial integrity, publisher authorization,
 * Scopus coverage or article indexing.
 */
import { isISSN, type JournalCheck, type ArticleCheck, type Evidence } from "./journalguard";

export const CLAIM_SCHEMA_VERSION = "journalguard.claims.v1" as const;
export type ClaimStatus = "supported" | "contradicted" | "unknown" | "not_applicable";
export type ClaimId =
  | "issn_checksum"
  | "website_https_scheme"
  | "publisher_domain_authorization"
  | "doi_syntax"
  | "doi_registration"
  | "doi_title_consistency"
  | "scopus_journal_coverage"
  | "scopus_article_indexing";
export interface ClaimFinding {
  claim: ClaimId;
  status: ClaimStatus;
  detail: string;
  evidenceSources: string[];
}

type ReportForClaims = {
  evidence: Evidence[];
  doiAgency?: { registered: boolean; title?: string; agency?: string } | null;
};
const normalize = (value: string) =>
  value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const doiValue = (value: string) =>
  value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
const doiSyntax = (value: string) => /^10\.\d{4,9}\/\S+$/i.test(doiValue(value));

/** Pure deterministic projection: callers cannot mark unverified Scopus data as supported. */
export function buildJournalClaimVector(
  journal: JournalCheck,
  article: ArticleCheck | undefined,
  report: ReportForClaims,
): ClaimFinding[] {
  const findings: ClaimFinding[] = [];
  const add = (claim: ClaimId, status: ClaimStatus, detail: string, evidenceSources: string[] = []) =>
    findings.push({ claim, status, detail, evidenceSources });

  if (journal.issn) {
    const valid = isISSN(journal.issn);
    add("issn_checksum", valid ? "supported" : "contradicted",
      valid ? "ISSN check digit satisfies the modulus-11 algorithm; registry identity not checked."
            : "Supplied ISSN fails the modulus-11 format/check-digit test.");
  } else add("issn_checksum", "not_applicable", "No ISSN supplied.");

  if (journal.website) {
    let status: ClaimStatus = "contradicted";
    try {
      const url = new URL(journal.website);
      status = url.protocol === "https:" ? "supported" : "contradicted";
    } catch { /* invalid URL contradicts the stated HTTPS URL format */ }
    add("website_https_scheme", status,
      status === "supported" ? "Supplied URL uses HTTPS; ownership, availability and TLS validation not checked."
                             : "Supplied URL is invalid or does not use HTTPS.");
    add("publisher_domain_authorization", "unknown",
      "No independently governed, currently valid publisher-domain registry is configured. Hostname matching alone cannot establish authorization.");
  } else {
    add("website_https_scheme", "not_applicable", "No website supplied.");
    add("publisher_domain_authorization", "not_applicable", "No website supplied.");
  }

  if (article?.doi) {
    const syntacticallyValid = doiSyntax(article.doi);
    add("doi_syntax", syntacticallyValid ? "supported" : "contradicted",
      syntacticallyValid ? "DOI has a syntactically valid prefix/suffix; registration is a separate claim."
                         : "DOI fails the configured syntax pattern.");
    const crossref = report.evidence.some(e => e.source === "Crossref");
    const datacite = report.doiAgency?.registered === true;
    add("doi_registration", (crossref || datacite) ? "supported" : "unknown",
      (crossref || datacite) ? "DOI metadata was returned by at least one registration agency; peer review and indexing are not implied."
                             : "No positive registration evidence available; API failures or absence from one agency cannot establish non-registration.",
      [...(crossref ? ["Crossref"] : []), ...(datacite ? ["DataCite"] : [])]);
    if (article.title && datacite && report.doiAgency?.title) {
      const match = normalize(article.title) === normalize(report.doiAgency.title);
      add("doi_title_consistency", match ? "supported" : "unknown",
        match ? "Normalized submitted title matches registered DataCite title."
              : "Submitted and DataCite titles differ; versions and punctuation require human review.",
        ["DataCite"]);
    } else {
      add("doi_title_consistency", "unknown",
        "Insufficient structured registration-agency title evidence for a reliable comparison.");
    }
  } else {
    add("doi_syntax", "not_applicable", "No DOI supplied.");
    add("doi_registration", "not_applicable", "No DOI supplied.");
    add("doi_title_consistency", "not_applicable", "No article DOI supplied.");
  }
  add("scopus_journal_coverage", "unknown",
    "Current journal coverage requires separately authorized, time-stamped Scopus source evidence.");
  add("scopus_article_indexing", article ? "unknown" : "not_applicable",
    article ? "Article indexing requires an authoritative Scopus document record." : "No article supplied.");
  return findings;
}
