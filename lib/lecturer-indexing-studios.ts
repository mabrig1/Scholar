export type ReadinessBand = "ready" | "almost" | "needs-work";

export type ReadinessCheck = {
  id: string;
  label: string;
  complete: boolean;
  points: number;
  maxPoints: number;
  evidence: string;
  action: string;
};

export type StudioAssessment = {
  score: number;
  band: ReadinessBand;
  label: string;
  checks: ReadinessCheck[];
  priorityActions: string[];
  nextLinks: Array<{ label: string; url: string }>;
  notice: string;
};

export type GoogleScholarInput = {
  publicProfile: boolean;
  institutionalEmailVerified: boolean;
  articleLandingPage: boolean;
  freeAbstractVisible: boolean;
  searchablePdf: boolean;
  oneArticlePerUrl: boolean;
  scholarMetaTags: boolean;
  robotsAllowed: boolean;
  titleAndAuthorsVisible: boolean;
  referencesPresent: boolean;
};

export type ScopusLecturerInput = {
  hasScopusProfile: boolean;
  profileHasCorrectName: boolean;
  profileHasCorrectAffiliation: boolean;
  duplicateProfilesResolved: boolean;
  missingIndexedDocumentsResolved: boolean;
  orcidConnected: boolean;
  targetJournalCurrentlyCovered: boolean;
  targetJournalScopeFit: boolean;
  manuscriptHasEnglishTitleAbstract: boolean;
  ethicsAndResearchIntegrityReady: boolean;
};

function bandFor(score: number): ReadinessBand {
  if (score >= 85) return "ready";
  if (score >= 65) return "almost";
  return "needs-work";
}

function labelFor(score: number, readyLabel: string) {
  if (score >= 85) return readyLabel;
  if (score >= 65) return "Almost ready — fix the remaining visibility gaps";
  return "Needs work before relying on indexing or profile visibility";
}

function calculate(checks: ReadinessCheck[]) {
  const max = checks.reduce((sum, item) => sum + item.maxPoints, 0);
  const earned = checks.reduce((sum, item) => sum + item.points, 0);
  return Math.round((earned / max) * 100);
}

export function assessGoogleScholarReadiness(input: GoogleScholarInput): StudioAssessment {
  const checks: ReadinessCheck[] = [
    {
      id: "public-profile",
      label: "Public Google Scholar profile",
      complete: input.publicProfile,
      points: input.publicProfile ? 12 : 0,
      maxPoints: 12,
      evidence: input.publicProfile
        ? "The lecturer profile is marked public."
        : "A private profile is not eligible to appear in Google Scholar author search.",
      action: "Make the Google Scholar profile public.",
    },
    {
      id: "institution-email",
      label: "Verified institutional email",
      complete: input.institutionalEmailVerified,
      points: input.institutionalEmailVerified ? 12 : 0,
      maxPoints: 12,
      evidence: input.institutionalEmailVerified
        ? "Institutional email verification is recorded."
        : "Google Scholar requires a verified institutional email for a public author profile to be eligible for profile search.",
      action: "Verify the lecturer's university/institution email on the Scholar profile.",
    },
    {
      id: "article-page",
      label: "Dedicated article landing page",
      complete: input.articleLandingPage && input.oneArticlePerUrl,
      points: input.articleLandingPage && input.oneArticlePerUrl ? 12 : 0,
      maxPoints: 12,
      evidence: input.articleLandingPage && input.oneArticlePerUrl
        ? "Each paper has a distinct public landing page."
        : "Scholar works best when each paper has its own crawlable URL.",
      action: "Create one public HTML landing page per article.",
    },
    {
      id: "abstract",
      label: "Full author-written abstract visible without login",
      complete: input.freeAbstractVisible,
      points: input.freeAbstractVisible ? 12 : 0,
      maxPoints: 12,
      evidence: input.freeAbstractVisible
        ? "The abstract is visible to readers and crawlers without authentication."
        : "A bare citation page or login wall can prevent inclusion.",
      action: "Expose the complete author-written abstract without login, popup or click-through barriers.",
    },
    {
      id: "pdf",
      label: "Searchable PDF available",
      complete: input.searchablePdf,
      points: input.searchablePdf ? 10 : 0,
      maxPoints: 10,
      evidence: input.searchablePdf
        ? "The article PDF is text-searchable."
        : "Scanned/image-only PDFs are poor Scholar indexing targets.",
      action: "Provide a text-searchable PDF and ensure the full paper is a single file.",
    },
    {
      id: "metadata",
      label: "Scholar/Highwire bibliographic meta tags",
      complete: input.scholarMetaTags,
      points: input.scholarMetaTags ? 16 : 0,
      maxPoints: 16,
      evidence: input.scholarMetaTags
        ? "Machine-readable citation metadata is present."
        : "Missing citation_title/citation_author-style metadata increases parser risk.",
      action: "Add Highwire/Scholar metadata such as citation_title, citation_author, citation_publication_date and citation_pdf_url.",
    },
    {
      id: "robots",
      label: "Googlebot can crawl article URLs",
      complete: input.robotsAllowed,
      points: input.robotsAllowed ? 10 : 0,
      maxPoints: 10,
      evidence: input.robotsAllowed
        ? "Robots rules do not block the scholarly pages."
        : "Robots blocking can remove papers from Scholar coverage.",
      action: "Allow Googlebot access to article landing pages, browse pages and PDFs.",
    },
    {
      id: "document-structure",
      label: "Conventional scholarly document structure",
      complete: input.titleAndAuthorsVisible && input.referencesPresent,
      points: input.titleAndAuthorsVisible && input.referencesPresent ? 16 : 0,
      maxPoints: 16,
      evidence: input.titleAndAuthorsVisible && input.referencesPresent
        ? "Title, authors and references are visible in conventional locations."
        : "Scholar's parser relies on clear title/author placement and a recognizable references section.",
      action: "Place the title prominently, list authors immediately below it, and include a References/Bibliography section.",
    },
  ];

  const score = calculate(checks);
  return {
    score,
    band: bandFor(score),
    label: labelFor(score, "Strong Google Scholar indexing-readiness profile"),
    checks,
    priorityActions: checks.filter((item) => !item.complete).map((item) => item.action).slice(0, 6),
    nextLinks: [
      { label: "Open live Scholar compatibility audit", url: "/admin/scholar-auditor" },
      { label: "Google Scholar inclusion guidelines", url: "https://scholar.google.com/intl/en/scholar/inclusion.html" },
      { label: "Google Scholar profile help", url: "https://scholar.google.com/intl/en/scholar/citations.html" },
    ],
    notice: "This studio improves technical eligibility and discoverability. Google controls crawling, inclusion, grouping and timing, so no indexing guarantee is possible.",
  };
}

export function assessScopusLecturerReadiness(input: ScopusLecturerInput): StudioAssessment {
  const checks: ReadinessCheck[] = [
    {
      id: "profile",
      label: "Scopus Author Profile exists",
      complete: input.hasScopusProfile,
      points: input.hasScopusProfile ? 12 : 0,
      maxPoints: 12,
      evidence: input.hasScopusProfile
        ? "A Scopus author record is available for the lecturer."
        : "Scopus author profiles are generated from publications already indexed in Scopus.",
      action: "Search Scopus Author Profiles using the lecturer's name, affiliation and ORCID.",
    },
    {
      id: "identity",
      label: "Preferred author name is correct",
      complete: input.profileHasCorrectName,
      points: input.profileHasCorrectName ? 10 : 0,
      maxPoints: 10,
      evidence: input.profileHasCorrectName ? "Preferred author name is correct." : "Name variation can split or misrepresent the publication record.",
      action: "Use the Scopus Author Feedback Wizard to request the preferred display name.",
    },
    {
      id: "affiliation",
      label: "Primary affiliation is correct",
      complete: input.profileHasCorrectAffiliation,
      points: input.profileHasCorrectAffiliation ? 10 : 0,
      maxPoints: 10,
      evidence: input.profileHasCorrectAffiliation ? "Primary affiliation is correct." : "Affiliation errors can weaken discoverability and institutional reporting.",
      action: "Request the correct primary affiliation through the Author Feedback Wizard.",
    },
    {
      id: "duplicates",
      label: "Duplicate author profiles resolved",
      complete: input.duplicateProfilesResolved,
      points: input.duplicateProfilesResolved ? 10 : 0,
      maxPoints: 10,
      evidence: input.duplicateProfilesResolved ? "No unresolved duplicate profiles are reported." : "Duplicate author IDs can fragment documents and citation metrics.",
      action: "Request profile merging where the lecturer has duplicate Scopus author records.",
    },
    {
      id: "missing-docs",
      label: "Missing indexed documents reviewed",
      complete: input.missingIndexedDocumentsResolved,
      points: input.missingIndexedDocumentsResolved ? 10 : 0,
      maxPoints: 10,
      evidence: input.missingIndexedDocumentsResolved ? "Known indexed publications are attached to the correct profile." : "Missing indexed documents can understate the lecturer's output.",
      action: "Check whether missing papers are indexed in Scopus; if they are, request assignment to the correct author profile.",
    },
    {
      id: "orcid",
      label: "ORCID identity is connected/consistent",
      complete: input.orcidConnected,
      points: input.orcidConnected ? 8 : 0,
      maxPoints: 8,
      evidence: input.orcidConnected ? "ORCID identity is aligned with the lecturer profile." : "ORCID helps reduce author ambiguity across publishing systems.",
      action: "Align the lecturer's ORCID, preferred publishing name and institutional affiliation.",
    },
    {
      id: "covered-source",
      label: "Target journal is currently covered by Scopus",
      complete: input.targetJournalCurrentlyCovered,
      points: input.targetJournalCurrentlyCovered ? 16 : 0,
      maxPoints: 16,
      evidence: input.targetJournalCurrentlyCovered
        ? "The target source has been checked for current Scopus coverage."
        : "Publishing in a non-covered source will not create a Scopus-indexed article simply because the author has a Scopus profile.",
      action: "Verify the target journal in the current Scopus Sources list before submission.",
    },
    {
      id: "scope-fit",
      label: "Manuscript fits the journal's current aims and scope",
      complete: input.targetJournalScopeFit,
      points: input.targetJournalScopeFit ? 10 : 0,
      maxPoints: 10,
      evidence: input.targetJournalScopeFit ? "Journal scope fit has been reviewed." : "Indexing status alone is not a publication strategy.",
      action: "Compare the manuscript with recent papers and the official aims/scope before submission.",
    },
    {
      id: "metadata",
      label: "English title and abstract are publication-ready",
      complete: input.manuscriptHasEnglishTitleAbstract,
      points: input.manuscriptHasEnglishTitleAbstract ? 7 : 0,
      maxPoints: 7,
      evidence: input.manuscriptHasEnglishTitleAbstract ? "English title/abstract are ready for international discovery." : "Clear English titles and abstracts support international readability and indexing.",
      action: "Prepare a precise English title, structured abstract and consistent keywords.",
    },
    {
      id: "integrity",
      label: "Research integrity and ethics package is ready",
      complete: input.ethicsAndResearchIntegrityReady,
      points: input.ethicsAndResearchIntegrityReady ? 7 : 0,
      maxPoints: 7,
      evidence: input.ethicsAndResearchIntegrityReady ? "Required integrity/ethics materials are prepared." : "Poor ethics or publication-integrity practice can trigger rejection or later source re-evaluation.",
      action: "Complete ethics statements, authorship declarations, data/conflict disclosures and citation checks before submission.",
    },
  ];

  const score = calculate(checks);
  return {
    score,
    band: bandFor(score),
    label: labelFor(score, "Strong Scopus lecturer visibility and publication-readiness profile"),
    checks,
    priorityActions: checks.filter((item) => !item.complete).map((item) => item.action).slice(0, 6),
    nextLinks: [
      { label: "Browse Scopus-covered sources", url: "/scopus-journals" },
      { label: "Open publishing pathway", url: "/publishing-agent" },
      { label: "Scopus Author Profiles", url: "https://www.elsevier.com/products/scopus/author-profiles" },
      { label: "Scopus content policy & selection", url: "https://www.elsevier.com/products/scopus/content/content-policy-and-selection" },
    ],
    notice: "Lecturers cannot manually make an ordinary article 'Scopus indexed'. Scopus indexes content from covered sources, then builds author profiles from that indexed content. This studio focuses on source verification, profile accuracy and publication readiness.",
  };
}
