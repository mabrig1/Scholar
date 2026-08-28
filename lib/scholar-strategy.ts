export type ScholarStrategyStatus = "strong" | "developing" | "foundation";

export type ScholarPhase = {
  id: string;
  title: string;
  status: "ready" | "needs-input" | "action-required";
  objective: string;
  actions: string[];
};

export type ScholarStrategy = {
  clientName: string;
  goal: string;
  readinessScore: number;
  readinessStatus: ScholarStrategyStatus;
  guaranteeNotice: string;
  controllableOutcome: string;
  phases: ScholarPhase[];
  verificationQueries: string[];
  metadataChecklist: string[];
  publisherDeliverables: string[];
};

export type ScholarStrategyInput = {
  clientName: string;
  authorAffiliation: string;
  orcid: string;
  title: string;
  abstract: string;
  publicationGoal: string;
  publicationStage: string;
  targetJournal: string;
  publicationDate: string;
  doi: string;
  articleUrl: string;
  fullTextUrl: string;
};

const clean = (value: string) => value.trim();
const isWebUrl = (value: string) => {
  try {
    const url = new URL(clean(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};
const safeHostname = (value: string) => {
  try {
    return new URL(clean(value)).hostname;
  } catch {
    return "TARGET-DOMAIN";
  }
};

export function buildScholarStrategy(input: ScholarStrategyInput): ScholarStrategy {
  let score = 0;
  if (clean(input.clientName)) score += 8;
  if (clean(input.authorAffiliation)) score += 7;
  if (/^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(clean(input.orcid))) score += 5;
  if (clean(input.title)) score += 12;
  if (clean(input.abstract).length >= 150) score += 10;
  if (clean(input.targetJournal)) score += 10;
  if (clean(input.publicationDate)) score += 5;
  if (clean(input.doi)) score += 10;
  if (isWebUrl(input.articleUrl)) score += 15;
  if (isWebUrl(input.fullTextUrl)) score += 10;
  if (["accepted", "published"].includes(clean(input.publicationStage).toLowerCase())) score += 8;

  score = Math.min(100, score);
  const readinessStatus: ScholarStrategyStatus = score >= 75 ? "strong" : score >= 45 ? "developing" : "foundation";
  const author = clean(input.clientName) || "the client";
  const title = clean(input.title) || "the manuscript";
  const target = clean(input.targetJournal) || "the eventual journal or repository";

  const phases: ScholarPhase[] = [
    {
      id: "identity",
      title: "1. Author identity & citation identity",
      status: clean(input.clientName) && clean(input.authorAffiliation) ? "ready" : "needs-input",
      objective: `Make ${author}'s scholarly identity consistent wherever the work appears.`,
      actions: [
        "Use the same author-name form across the manuscript, journal submission, ORCID, institutional profile and repository record.",
        clean(input.authorAffiliation) ? `Preserve the affiliation exactly as supplied: ${clean(input.authorAffiliation)}.` : "Capture the author's official institutional affiliation before submission.",
        clean(input.orcid) ? "Link the ORCID identifier wherever the journal or repository supports it." : "Create or capture the author's ORCID and add it to submission metadata where supported.",
      ],
    },
    {
      id: "venue",
      title: "2. Publication venue & Scholar evidence",
      status: clean(input.targetJournal) ? "ready" : "action-required",
      objective: "Prefer reputable venues whose recent articles can already be discovered in Google Scholar and whose article pages expose stable bibliographic metadata.",
      actions: [
        clean(input.targetJournal) ? `Audit recent articles from ${target} by exact-title search in Google Scholar before recommending it to the client.` : "Shortlist reputable journals, then test several recent article titles from each candidate in Google Scholar.",
        "Verify the venue independently using ISSN/publisher records, Crossref/OpenAlex/DOAJ evidence where applicable, and the official journal website.",
        "Do not treat Google Scholar presence alone as proof that a journal is reputable.",
      ],
    },
    {
      id: "metadata",
      title: "3. Canonical article metadata",
      status: clean(input.title) && clean(input.clientName) && clean(input.publicationDate) ? "ready" : "needs-input",
      objective: "Ensure the publication record can be parsed as a scholarly article rather than a generic webpage.",
      actions: [
        `Preserve one authoritative title for the work: “${title}”.`,
        "For a publisher-hosted article page, expose Highwire/Scholar-compatible citation metadata such as citation_title, citation_author and citation_publication_date.",
        "Add journal title, ISSN, volume, issue, first/last page or article number, and citation_pdf_url when those values exist.",
        clean(input.doi) ? `Keep the DOI (${clean(input.doi)}) identical across the article page, PDF, Crossref metadata and repository deposits.` : "When a DOI is assigned, align the DOI across the journal page, Crossref record, PDF and all legitimate repository versions.",
      ],
    },
    {
      id: "landing-page",
      title: "4. Scholar-compatible article landing page",
      status: isWebUrl(input.articleUrl) ? "ready" : "action-required",
      objective: "Give each article one stable, crawlable URL with enough information for humans and scholarly crawlers.",
      actions: [
        isWebUrl(input.articleUrl) ? `Audit the canonical article URL: ${clean(input.articleUrl)}.` : "Once published, capture the permanent article landing-page URL.",
        "The article should have its own URL; do not place multiple article abstracts on one page.",
        "Show at least the complete author-written abstract without requiring login, form submission or JavaScript-only navigation.",
        "Use ordinary HTML links so crawlers can reach the article from journal/archive browse pages.",
      ],
    },
    {
      id: "fulltext",
      title: "5. Searchable full text / PDF",
      status: isWebUrl(input.fullTextUrl) ? "ready" : "needs-input",
      objective: "Make the authoritative or legally shareable full text machine-readable and correctly associated with the article record.",
      actions: [
        isWebUrl(input.fullTextUrl) ? `Check that the supplied full-text URL is persistent and crawlable: ${clean(input.fullTextUrl)}.` : "Capture the publisher PDF or a legally permitted repository manuscript URL when available.",
        "Use searchable text rather than an image-only scan; the title should be prominent, authors clearly listed, and the references section explicitly labelled.",
        "If hosting the PDF yourself for Scholar discovery, keep it within Google's documented Scholar file-size and formatting requirements.",
        "Respect the journal's copyright/self-archiving policy before depositing an accepted manuscript or publisher PDF elsewhere.",
      ],
    },
    {
      id: "crawl",
      title: "6. Crawlability & technical indexing",
      status: isWebUrl(input.articleUrl) ? "action-required" : "needs-input",
      objective: "Prevent technical configuration from hiding a legitimate scholarly article from search robots.",
      actions: [
        "Check robots.txt and page-level robots directives so article and browse URLs are not blocked from Google crawlers.",
        "Avoid login walls for the abstract, broken redirects, repeated 5xx errors, very slow article pages and JavaScript-only discovery paths.",
        "If an article URL changes, use a permanent 301 redirect to the new article URL—not to the website homepage.",
        "For a journal/repository with many records, maintain a simple browse-by-date interface using crawlable HTML links.",
      ],
    },
    {
      id: "distribution",
      title: "7. Legitimate discovery routes",
      status: "action-required",
      objective: "Increase legitimate opportunities for crawlers and researchers to discover the work without creating deceptive duplicate publications.",
      actions: [
        "Where publisher policy permits, deposit an accepted manuscript in the author's institutional repository or another appropriate scholarly repository.",
        "Link the work from the author's institutional publications page using the exact title and stable article/full-text URL.",
        "Register and maintain accurate DOI metadata through the publishing venue; align title, authors and publication date across versions.",
        "Avoid spammy backlinks, fake citations, duplicate journal publication or fabricated profiles. Visibility must come from legitimate scholarly records.",
      ],
    },
    {
      id: "monitoring",
      title: "8. Scholar monitoring & troubleshooting",
      status: clean(input.articleUrl) || clean(input.doi) ? "action-required" : "needs-input",
      objective: "Track discovery systematically and diagnose whether a missing record is a metadata, crawl or coverage problem.",
      actions: [
        "Search the exact article title in quotation marks in Google Scholar after publication.",
        "Search by author name plus distinctive title words, and compare the Scholar result with the canonical publisher record.",
        "For a publisher/repository domain, use a Google Scholar site:domain query to sample coverage and inspect whether titles/authors are being parsed correctly.",
        "If a record is absent, audit metadata extraction, crawler access, article-page structure and server availability before assuming the venue is excluded.",
        "Document the date of each check; Scholar updates are automated and can take time, so never sell a guaranteed indexing deadline.",
      ],
    },
  ];

  return {
    clientName: author,
    goal: clean(input.publicationGoal) || "Global scholarly visibility",
    readinessScore: score,
    readinessStatus,
    guaranteeNotice: "Google Scholar inclusion and timing are controlled by Google's automated systems. Researcher Pro can optimize technical eligibility, metadata, crawlability and legitimate discovery routes, but must never guarantee indexing or ranking.",
    controllableOutcome: "The publisher can deliver a documented Scholar-readiness package: verified venue evidence, consistent author/article metadata, crawlable article architecture, compliant full-text strategy, repository/distribution plan and a monitoring protocol.",
    phases,
    verificationQueries: [
      `\"${title}\"`,
      `${author} ${clean(input.title).split(/\s+/).slice(0, 5).join(" ")}`.trim(),
      isWebUrl(input.articleUrl) ? `site:${safeHostname(input.articleUrl)} \"${clean(input.title).slice(0, 80)}\"` : "site:TARGET-DOMAIN \"ARTICLE TITLE\"",
    ],
    metadataChecklist: [
      "citation_title",
      "citation_author (one tag per author)",
      "citation_publication_date",
      "citation_journal_title (for journal articles)",
      "citation_issn where available",
      "citation_volume / citation_issue where applicable",
      "citation_firstpage / citation_lastpage or equivalent article identifier",
      "citation_pdf_url for the corresponding full text where appropriate",
      "DOI and canonical URL consistency",
    ],
    publisherDeliverables: [
      "Google Scholar eligibility/readiness audit",
      "Author identity and metadata normalization sheet",
      "Journal Scholar-presence evidence check",
      "Article-page Highwire metadata specification",
      "PDF/full-text discoverability checklist",
      "Robots/crawlability technical audit",
      "Institutional-repository/self-archiving route check",
      "Post-publication Scholar monitoring log and troubleshooting plan",
    ],
  };
}
