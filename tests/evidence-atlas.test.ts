import assert from "node:assert/strict";
import test from "node:test";
import {
  addAtlasClaim,
  addAtlasPaper,
  createAtlasProject,
  logAtlasSearch,
  parseAtlasProject,
  recordAtlasEvidence,
  summarizeAtlasClaim,
} from "../lib/evidence-atlas";

const paper = {
  doi: "10.1234/atlas.2026.42",
  title: "Motivation and performance in public service",
  journal: "A verified metadata entry",
  year: 2026,
  authors: [{ given: "Ada", family: "Okoro" }],
  abstract: "This abstract reports a significant but context-specific association.",
  verification: "crossref" as const,
  retracted: false,
};

test("can build and round-trip a real claim-paper evidence map", () => {
  let map = createAtlasProject("Motivation in government", "How does employee motivation relate to performance?");
  map = addAtlasPaper(map, paper);
  map = addAtlasClaim(map, "Financial incentives influence employee performance.");
  map = recordAtlasEvidence(map, {
    claimId: map.claims[0].id,
    paperId: map.papers[0].id,
    stance: "mixed",
    basis: "abstract",
    excerpt: "This abstract reports a significant but context-specific association.",
    locator: "Abstract",
    notes: "No full-text review.",
  });
  assert.deepEqual(summarizeAtlasClaim(map, map.claims[0].id), {
    supports: 0, contradicts: 0, mixed: 1, unclear: 0, total: 1, abstractOnly: 1,
  });
  const roundTrip = parseAtlasProject(JSON.parse(JSON.stringify(map)));
  assert.equal(roundTrip.evidence[0].paperId, map.papers[0].id);
  assert.equal(roundTrip.events.at(-1)?.action, "assessment-recorded");
});

test("deduplicates saved sources by DOI and claims by case", () => {
  let map = createAtlasProject("Workforce productivity", "Is workplace recognition correlated with performance?");
  map = addAtlasPaper(map, paper);
  map = addAtlasPaper(map, { ...paper, doi: "HTTPS://DOI.ORG/10.1234/ATLAS.2026.42" });
  map = addAtlasClaim(map, "Recognition is associated with employee commitment.");
  map = addAtlasClaim(map, "recognition is associated with employee commitment.");
  assert.equal(map.papers.length, 1);
  assert.equal(map.claims.length, 1);
});

test("reclassification replaces the same study-claim pair without inflating agreement", () => {
  let map = addAtlasClaim(addAtlasPaper(createAtlasProject("Review project", "Which factors predict motivation at work?"), paper),
    "Financial incentives influence employee performance.");
  const input = {
    paperId: map.papers[0].id,
    claimId: map.claims[0].id,
    stance: "supports" as const,
    basis: "abstract" as const,
    excerpt: "The authors report an association in their abstract.",
    locator: "Abstract",
    notes: "",
  };
  map = recordAtlasEvidence(map, input);
  map = recordAtlasEvidence(map, { ...input, stance: "contradicts", basis: "full-text" });
  assert.equal(map.evidence.length, 1);
  assert.equal(map.evidence[0].stance, "contradicts");
  assert.equal(summarizeAtlasClaim(map, map.claims[0].id).supports, 0);
  assert.equal(summarizeAtlasClaim(map, map.claims[0].id).abstractOnly, 0);
  assert.equal(map.events.at(-1)?.action, "assessment-revised");
});

test("rejects forged and orphaned import records", () => {
  let map = addAtlasClaim(addAtlasPaper(createAtlasProject("Evidence import", "What is supported by the current available papers?"), paper),
    "Workplace benefits are associated with improved productivity.");
  map = recordAtlasEvidence(map, {
    claimId: map.claims[0].id, paperId: map.papers[0].id, stance: "unclear", basis: "abstract",
    excerpt: "A source passage requires careful independent checking.", locator: "Abstract", notes: "",
  });
  const forged = JSON.parse(JSON.stringify(map));
  forged.evidence[0].paperId = "missing";
  assert.throws(() => parseAtlasProject(forged), /orphaned/);
  const malformed = JSON.parse(JSON.stringify(map));
  malformed.evidence[0].stance = "conclusive";
  assert.throws(() => parseAtlasProject(malformed), /unsupported/);
  assert.throws(() => parseAtlasProject({ version: 999 }), /Invalid/);
});

test("forbids source-free classifications and maintains a bounded research log", () => {
  const map = addAtlasClaim(addAtlasPaper(createAtlasProject("Evidence audit", "Can the results be reproduced from the source documents?"), paper),
    "Reported methods change the interpretation of research findings.");
  assert.throws(() => recordAtlasEvidence(map, {
    claimId: map.claims[0].id, paperId: map.papers[0].id, stance: "supports",
    basis: "abstract", excerpt: "yes", locator: "", notes: "",
  }), /excerpt/);
  let next = map;
  for (let i = 0; i < 260; i += 1) next = logAtlasSearch(next, "public administration", 1);
  assert.ok(next.events.length <= 250);
  assert.equal(next.events.at(-1)?.action, "search");
});
