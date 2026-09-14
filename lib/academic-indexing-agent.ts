import { assessGoogleScholarReadiness, type StudioAssessment } from "@/lib/lecturer-indexing-studios";

export type MissionStatus = "done" | "current" | "blocked" | "pending";

export type AcademicIndexingInput = {
  fullName: string;
  institution: string;
  institutionalEmailVerified: boolean;
  publicScholarProfile: boolean;
  orcid: string;

  title: string;
  authors: string[];
  year: string;
  journal: string;
  doi: string;
  abstract: string;
  articleUrl: string;
  pdfUrl: string;

  rightsConfirmed: boolean;
  publicLandingPage: boolean;
  freeAbstractVisible: boolean;
  searchablePdf: boolean;
  oneArticlePerUrl: boolean;
  scholarMetaTags: boolean;
  robotsAllowed: boolean;
  titleAndAuthorsVisible: boolean;
  referencesPresent: boolean;
  canonicalUrl: boolean;
  sitemapIncluded: boolean;
  linkedFromAuthorPage: boolean;

  googleSearchVisible: boolean;
  googleScholarVisible: boolean;
};

export type MissionStage = {
  id: string;
  title: string;
  status: MissionStatus;
  summary: string;
  actions: string[];
  blockers: string[];
};

export type AcademicIndexingMission = {
  readiness: StudioAssessment;
  stages: MissionStage[];
  progress: number;
  nextAction: string;
  highwireMetaTags: string;
  jsonLd: string;
  verificationLinks: Array<{ label: string; url: string }>;
  warnings: string[];
  policyNotice: string;
};

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeHtml(value: string) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function validYear(value: string) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1500 && year <= 2200;
}

function normalizeDoi(value: string) {
  return clean(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

function hostFor(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function stage(
  id: string,
  title: string,
  complete: boolean,
  blockers: string[],
  summary: string,
  actions: string[],
): MissionStage {
  return {
    id,
    title,
    status: complete ? "done" : blockers.length ? "blocked" : "pending",
    summary,
    actions,
    blockers,
  };
}

function markCurrent(stages: MissionStage[]) {
  const firstOpen = stages.findIndex((item) => item.status !== "done");
  if (firstOpen >= 0) stages[firstOpen] = { ...stages[firstOpen], status: "current" };
  return stages;
}

export function buildHighwireMetaTags(input: AcademicIndexingInput) {
  const lines: string[] = [];
  const title = clean(input.title);
  if (title) lines.push(`<meta name="citation_title" content="${escapeHtml(title)}" />`);

  for (const author of input.authors.map(clean).filter(Boolean)) {
    lines.push(`<meta name="citation_author" content="${escapeHtml(author)}" />`);
  }

  if (validYear(input.year)) {
    lines.push(`<meta name="citation_publication_date" content="${escapeHtml(input.year)}" />`);
  }
  if (clean(input.journal)) {
    lines.push(`<meta name="citation_journal_title" content="${escapeHtml(input.journal)}" />`);
  }
  const doi = normalizeDoi(input.doi);
  if (doi) lines.push(`<meta name="citation_doi" content="${escapeHtml(doi)}" />`);
  if (clean(input.pdfUrl)) {
    lines.push(`<meta name="citation_pdf_url" content="${escapeHtml(input.pdfUrl)}" />`);
  }
  if (clean(input.articleUrl)) {
    lines.push(`<link rel="canonical" href="${escapeHtml(input.articleUrl)}" />`);
  }
  return lines.join("\n");
}

export function buildScholarlyArticleJsonLd(input: AcademicIndexingInput) {
  const doi = normalizeDoi(input.doi);
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: clean(input.title) || undefined,
    author: input.authors.map(clean).filter(Boolean).map((name) => ({ "@type": "Person", name })),
    datePublished: validYear(input.year) ? input.year : undefined,
    isPartOf: clean(input.journal) ? { "@type": "Periodical", name: clean(input.journal) } : undefined,
    abstract: clean(input.abstract) || undefined,
    identifier: doi ? `https://doi.org/${doi}` : undefined,
    url: clean(input.articleUrl) || undefined,
    encoding: clean(input.pdfUrl)
      ? { "@type": "MediaObject", contentUrl: clean(input.pdfUrl), encodingFormat: "application/pdf" }
      : undefined,
  };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined || (Array.isArray(payload[key]) && !(payload[key] as unknown[]).length)) {
      delete payload[key];
    }
  }
  return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

export function buildVerificationLinks(input: AcademicIndexingInput) {
  const links: Array<{ label: string; url: string }> = [];
  const title = clean(input.title);
  const articleHost = hostFor(input.articleUrl);

  if (title) {
    links.push({
      label: "Exact-title Google Search",
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${title}"`)}`,
    });
    links.push({
      label: "Exact-title Google Scholar search",
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${title}"`)}`,
    });
    links.push({
      label: "OpenAlex title search",
      url: `https://openalex.org/works?search=${encodeURIComponent(title)}`,
    });
  }
  if (articleHost) {
    links.push({
      label: "Google site: check for hosting domain",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${articleHost} "${title}"`)}`,
    });
  }
  const doi = normalizeDoi(input.doi);
  if (doi) links.push({ label: "Resolve DOI", url: `https://doi.org/${encodeURI(doi)}` });
  if (clean(input.orcid)) {
    const id = clean(input.orcid).replace(/^https?:\/\/orcid\.org\//i, "");
    links.push({ label: "Open ORCID record", url: `https://orcid.org/${encodeURIComponent(id)}` });
  }
  return links;
}

export function buildAcademicIndexingMission(input: AcademicIndexingInput): AcademicIndexingMission {
  const readiness = assessGoogleScholarReadiness({
    publicProfile: input.publicScholarProfile,
    institutionalEmailVerified: input.institutionalEmailVerified,
    articleLandingPage: input.publicLandingPage,
    freeAbstractVisible: input.freeAbstractVisible,
    searchablePdf: input.searchablePdf,
    oneArticlePerUrl: input.oneArticlePerUrl,
    scholarMetaTags: input.scholarMetaTags,
    robotsAllowed: input.robotsAllowed,
    titleAndAuthorsVisible: input.titleAndAuthorsVisible,
    referencesPresent: input.referencesPresent,
  });

  const identityBlockers = [
    !clean(input.fullName) ? "Add the researcher's full publishing name." : "",
    !clean(input.institution) ? "Add the current institution or research affiliation." : "",
  ].filter(Boolean);

  const metadataBlockers = [
    !clean(input.title) ? "Add the paper title." : "",
    !input.authors.map(clean).filter(Boolean).length ? "Add at least one author." : "",
    !validYear(input.year) ? "Add a valid publication year." : "",
    clean(input.abstract).length < 80 ? "Add the complete author-written abstract." : "",
  ].filter(Boolean);

  const hostingBlockers = [
    !input.rightsConfirmed ? "Confirm you are allowed to make this version public." : "",
    !clean(input.articleUrl) ? "Provide one permanent public landing-page URL for this paper." : "",
    !input.publicLandingPage ? "Make the landing page public without login." : "",
    !input.freeAbstractVisible ? "Show the complete author-written abstract on the landing page." : "",
    !input.oneArticlePerUrl ? "Use one paper per unique URL." : "",
  ].filter(Boolean);

  const documentBlockers = [
    !input.titleAndAuthorsVisible ? "Place the title prominently and authors immediately below it." : "",
    !input.referencesPresent ? "Include a conventional References or Bibliography section." : "",
    input.pdfUrl && !input.searchablePdf ? "Replace an image-only PDF with a text-searchable PDF." : "",
  ].filter(Boolean);

  const markupBlockers = [
    !input.scholarMetaTags ? "Deploy citation_title and one citation_author tag per author." : "",
    !input.canonicalUrl ? "Add a canonical URL for the article landing page." : "",
  ].filter(Boolean);

  const discoveryBlockers = [
    !input.robotsAllowed ? "Allow Googlebot to crawl the article page and downloadable paper." : "",
    !input.sitemapIncluded ? "Include the landing page in the site's XML sitemap." : "",
    !input.linkedFromAuthorPage ? "Link the paper from an author, department, repository, or publications page." : "",
  ].filter(Boolean);

  const verificationComplete = input.googleSearchVisible && input.googleScholarVisible;
  const verificationBlockers = input.googleSearchVisible
    ? []
    : ["First verify that ordinary Google Search can discover the public article page."];

  const stages = markCurrent([
    stage(
      "identity",
      "1. Establish researcher identity",
      identityBlockers.length === 0,
      identityBlockers,
      "Stabilize the author's publishing identity before chasing indexing.",
      [
        "Use one consistent publishing name across the paper, ORCID, institutional page and Google Scholar profile.",
        "Create or clean up ORCID and make the Google Scholar profile public when available.",
        "Verify an institutional email on the Google Scholar profile when the institution provides one.",
      ],
    ),
    stage(
      "metadata",
      "2. Normalize the scholarly record",
      metadataBlockers.length === 0,
      metadataBlockers,
      "Give crawlers a complete, unambiguous bibliographic record.",
      [
        "Confirm title, all authors, year, journal/repository, DOI if one exists, and the full author-written abstract.",
        "Keep the paper title identical across PDF, landing page, DOI record and repository metadata.",
      ],
    ),
    stage(
      "hosting",
      "3. Publish a rights-safe landing page",
      hostingBlockers.length === 0,
      hostingBlockers,
      "Expose a stable public page without violating publisher or repository rights.",
      [
        "Use the version you are legally allowed to share: published OA version, accepted manuscript, preprint, thesis, or repository copy.",
        "Put each work on its own permanent URL and expose at least the complete author-written abstract without login.",
      ],
    ),
    stage(
      "document",
      "4. Make the document parser-friendly",
      documentBlockers.length === 0,
      documentBlockers,
      "Help Google Scholar's parser recognize the paper and bibliography.",
      [
        "Use a text-searchable single PDF when full text is provided.",
        "Place a large, clear title at the top, authors directly underneath, and a References/Bibliography section at the end.",
      ],
    ),
    stage(
      "markup",
      "5. Deploy Scholar-compatible metadata",
      markupBlockers.length === 0 && metadataBlockers.length === 0,
      [...metadataBlockers, ...markupBlockers],
      "Add Highwire/Google Scholar bibliographic meta tags to the article page.",
      [
        "Paste the generated citation meta tags into the HTML head.",
        "Use one citation_author meta tag for each actual author; do not put affiliations or degrees in that field.",
        "Keep the canonical URL and citation_pdf_url public and stable.",
      ],
    ),
    stage(
      "discovery",
      "6. Build crawl and discovery paths",
      discoveryBlockers.length === 0,
      discoveryBlockers,
      "Make the page easy for ordinary Google Search and Google Scholar crawlers to discover.",
      [
        "Allow crawling in robots.txt and page-level robots directives.",
        "Add the article landing page to the XML sitemap and submit the sitemap in Google Search Console.",
        "Link the work from institutional, author, project, repository, DOI/ORCID, or publications pages where appropriate.",
        "Use Search Console URL Inspection for the public landing page. Do not fake JobPosting or BroadcastEvent markup to access Google's Indexing API.",
      ],
    ),
    stage(
      "verify",
      "7. Verify, monitor and repair",
      verificationComplete,
      verificationBlockers,
      "Check discovery first in Google Search, then verify Google Scholar inclusion and bibliographic parsing.",
      [
        "Search the exact title in Google Search and Google Scholar.",
        "If Google Search sees the page but Scholar does not, re-check abstracts, metadata, PDF structure and one-paper-per-URL requirements.",
        "If Scholar shows the paper with wrong title/authors, repair the landing-page metadata and keep the corrected page stable for recrawling.",
        "Record inclusion manually; Google controls crawl timing, grouping and final inclusion.",
      ],
    ),
  ]);

  const completed = stages.filter((item) => item.status === "done").length;
  const progress = Math.round((completed / stages.length) * 100);
  const current = stages.find((item) => item.status === "current");
  const nextAction =
    current?.blockers[0] ||
    current?.actions[0] ||
    "Maintain stable metadata and periodically verify the exact paper title in Google Scholar.";

  const warnings: string[] = [];
  if (!input.rightsConfirmed) {
    warnings.push("Do not upload a publisher PDF unless the licence or publisher policy permits it. Use an accepted manuscript, preprint or repository version when appropriate.");
  }
  if (!normalizeDoi(input.doi)) {
    warnings.push("A DOI is helpful but not mandatory for Google Scholar. Do not invent one; use the publisher/repository record if no DOI exists.");
  }
  if (!input.publicScholarProfile) {
    warnings.push("A Google Scholar author profile improves author visibility, but article inclusion depends primarily on crawlable scholarly content and parsable metadata.");
  }

  return {
    readiness,
    stages,
    progress,
    nextAction,
    highwireMetaTags: buildHighwireMetaTags(input),
    jsonLd: buildScholarlyArticleJsonLd(input),
    verificationLinks: buildVerificationLinks(input),
    warnings,
    policyNotice:
      "Google Scholar and Google decide whether and when content is crawled, indexed, grouped or displayed. This agent improves eligibility and discoverability; it cannot guarantee indexing. Google's Indexing API is intentionally not used for academic article pages because Google restricts it to JobPosting pages and livestream BroadcastEvent pages.",
  };
}
