import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAcademicIndexingMission,
  buildHighwireMetaTags,
  type AcademicIndexingInput,
} from "../lib/academic-indexing-agent";

const complete: AcademicIndexingInput = {
  fullName: "Ada N. Okafor",
  institution: "Example University",
  institutionalEmailVerified: true,
  publicScholarProfile: true,
  orcid: "0000-0002-1825-0097",
  title: "A Public Administration Study of Local Service Delivery",
  authors: ["Ada N. Okafor", "Bello Musa"],
  year: "2026",
  journal: "Journal of Public Administration",
  doi: "10.1234/example.2026.1",
  abstract: "This study examines local service delivery using a mixed-method design and reports evidence on institutional capacity, implementation constraints and measurable outcomes across selected local administrations.",
  articleUrl: "https://repository.example.edu/articles/local-service-delivery",
  pdfUrl: "https://repository.example.edu/articles/local-service-delivery.pdf",
  rightsConfirmed: true,
  publicLandingPage: true,
  freeAbstractVisible: true,
  searchablePdf: true,
  oneArticlePerUrl: true,
  scholarMetaTags: true,
  robotsAllowed: true,
  titleAndAuthorsVisible: true,
  referencesPresent: true,
  canonicalUrl: true,
  sitemapIncluded: true,
  linkedFromAuthorPage: true,
  googleSearchVisible: true,
  googleScholarVisible: true,
};

test("complete indexing mission reaches full readiness and verification", () => {
  const result = buildAcademicIndexingMission(complete);
  assert.equal(result.readiness.score, 100);
  assert.equal(result.progress, 100);
  assert.ok(result.stages.every((stage) => stage.status === "done"));
  assert.match(result.policyNotice, /cannot guarantee indexing/i);
  assert.match(result.policyNotice, /Indexing API/i);
});

test("mission prioritizes public metadata and hosting blockers", () => {
  const result = buildAcademicIndexingMission({
    ...complete,
    abstract: "",
    articleUrl: "",
    publicLandingPage: false,
    freeAbstractVisible: false,
    oneArticlePerUrl: false,
    scholarMetaTags: false,
    canonicalUrl: false,
    googleSearchVisible: false,
    googleScholarVisible: false,
  });
  const current = result.stages.find((stage) => stage.status === "current");
  assert.equal(current?.id, "metadata");
  assert.match(result.nextAction, /abstract/i);
  assert.ok(result.progress < 100);
});

test("Highwire generator emits one citation_author tag per author", () => {
  const tags = buildHighwireMetaTags(complete);
  assert.match(tags, /citation_title/);
  assert.equal((tags.match(/citation_author/g) || []).length, 2);
  assert.match(tags, /citation_pdf_url/);
  assert.match(tags, /rel="canonical"/);
});
