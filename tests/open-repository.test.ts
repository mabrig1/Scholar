import assert from "node:assert/strict";
import test from "node:test";
import {
  assessRepositorySubmission,
  buildRepositoryHighwireMeta,
  normalizeDoi,
  normalizeOrcid,
  repositoryJsonLd,
  researcherSlug,
  workSlug,
  type RepositorySubmissionInput,
} from "../lib/open-repository";

const complete: RepositorySubmissionInput = {
  fullName: "Ada N. Okafor",
  affiliation: "Example University",
  department: "Public Administration",
  contactEmail: "ada@example.edu",
  orcid: "https://orcid.org/0000-0002-1825-0097",
  bio: "Researcher in public administration and local governance.",
  title: "Institutional Capacity and Local Service Delivery in Emerging Municipal Systems",
  authors: ["Ada N. Okafor", "Bello Musa"],
  year: 2026,
  workType: "ARTICLE",
  abstract:
    "This study examines institutional capacity and local service delivery through a mixed-method design, reporting evidence on administrative coordination, implementation constraints and measurable service outcomes across selected municipal systems.",
  keywords: ["institutional capacity", "local governance", "service delivery"],
  journal: "Journal of Public Administration",
  doi: "https://doi.org/10.1234/Example.2026.1",
  externalUrl: "https://repository.example.edu/work/123",
  license: "CC BY 4.0",
  rightsStatement: "Author is permitted to deposit this open-access version.",
  rightsConfirmed: true,
};

test("repository readiness accepts a complete rights-safe submission", () => {
  const result = assessRepositorySubmission(complete);
  assert.equal(result.readyForReview, true);
  assert.equal(result.score, 100);
  assert.equal(result.blockers.length, 0);
});

test("repository readiness blocks missing rights and weak metadata", () => {
  const result = assessRepositorySubmission({
    ...complete,
    contactEmail: "invalid",
    abstract: "Too short",
    rightsConfirmed: false,
  });
  assert.equal(result.readyForReview, false);
  assert.ok(result.blockers.some((item) => /email/i.test(item)));
  assert.ok(result.blockers.some((item) => /abstract/i.test(item)));
  assert.ok(result.blockers.some((item) => /right/i.test(item)));
});

test("repository slugs are stable and identity-aware", () => {
  const first = researcherSlug(complete.fullName, complete.orcid);
  const second = researcherSlug(complete.fullName, complete.orcid);
  assert.equal(first, second);
  assert.notEqual(first, researcherSlug(complete.fullName, "0000-0001-1111-1111"));

  const workA = workSlug(complete);
  const workB = workSlug(complete);
  assert.equal(workA, workB);
  assert.match(workA, /-2026-[a-f0-9]{8}$/);
});

test("repository metadata normalizes DOI and emits one author value per author", () => {
  assert.equal(normalizeDoi(complete.doi), "10.1234/example.2026.1");
  assert.equal(normalizeOrcid(complete.orcid), "0000-0002-1825-0097");

  const tags = buildRepositoryHighwireMeta({
    title: complete.title,
    authors: complete.authors,
    year: complete.year,
    journal: complete.journal,
    doi: complete.doi,
    canonicalUrl: "https://scholar.example/repository/works/example",
    pdfUrl: "https://scholar.example/repository/files/example",
  });

  assert.deepEqual(tags.citation_author, complete.authors);
  assert.equal(tags.citation_doi, "10.1234/example.2026.1");
  assert.equal(tags.citation_publication_date, "2026");
  assert.equal(tags.citation_pdf_url, "https://scholar.example/repository/files/example");
});

test("repository JSON-LD exposes scholarly identity without inventing fields", () => {
  const data = repositoryJsonLd({
    title: complete.title,
    authors: [
      { name: complete.authors[0], orcid: complete.orcid },
      { name: complete.authors[1] },
    ],
    year: complete.year,
    abstract: complete.abstract,
    keywords: complete.keywords,
    journal: complete.journal,
    doi: complete.doi,
    canonicalUrl: "https://scholar.example/repository/works/example",
    pdfUrl: "https://scholar.example/repository/files/example",
    license: complete.license,
  }) as Record<string, unknown>;

  assert.equal(data["@type"], "ScholarlyArticle");
  assert.equal(data.identifier, "https://doi.org/10.1234/example.2026.1");
  assert.equal(data.license, "CC BY 4.0");
});
