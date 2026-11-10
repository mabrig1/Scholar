import assert from "node:assert/strict";
import test from "node:test";
import {
  addAtlasClaim, addAtlasPaper, createAtlasProject, parseAtlasProject,
} from "../packages/evidence-atlas-core/src/index";
import {
  approveGroundedProposal, proposeAbstractClaims, validateGroundedProposal,
} from "../packages/evidence-atlas-core/src/claim-proposals";

const article = {
  doi: "10.1234/example.2026.987", title: "Public sector incentives and performance",
  year: 2026, journal: "Public Administration Quarterly",
  authors: [{ given: "Ada", family: "Nnaji" }],
  abstract: "The authors investigated a sample from two public institutions. Results showed a statistically significant association between incentive recognition and reported employee productivity. The paper recommends additional research to confirm the effect in other settings.",
  verification: "crossref" as const, retracted: false,
};

function project() {
  return addAtlasPaper(createAtlasProject("Employee motivation", "Do financial incentives correlate with workplace productivity?"), article);
}
test("proposes only exact text spans from saved DOI-backed abstract", () => {
  const map = project();
  const candidates = proposeAbstractClaims(map.papers[0]);
  assert.ok(candidates.length >= 2);
  assert.ok(candidates.length <= 6);
  for (const candidate of candidates) {
    assert.equal(map.papers[0].abstract.slice(candidate.start, candidate.end), candidate.excerpt);
    assert.equal(candidate.claimText, candidate.excerpt);
    assert.equal(candidate.paperId, map.papers[0].id);
    assert.equal(candidate.doi, map.papers[0].doi);
    assert.equal(candidate.id, map.papers[0].id + ":" + candidate.start + "-" + candidate.end);
  }
  assert.equal(candidates[0].signal, "possible-result-statement");
});

test("human approval stores source anchor and never silently creates evidence", () => {
  const map = project();
  const candidate = proposeAbstractClaims(map.papers[0])[0];
  const updated = approveGroundedProposal(map, candidate);
  assert.equal(updated.claims.length, 1);
  assert.equal(updated.evidence.length, 0);
  assert.equal(updated.claims[0].origin?.paperId, map.papers[0].id);
  assert.equal(updated.claims[0].origin?.reviewStatus, "proposal-approved");
  assert.equal(updated.claims[0].origin?.excerpt, candidate.excerpt);
  assert.equal(updated.events.at(-1)?.action, "grounded-claim-approved");
  const exported = parseAtlasProject(JSON.parse(JSON.stringify(updated)));
  assert.equal(exported.claims[0].origin?.excerpt, candidate.excerpt);
});

test("rejects candidate hallucination, mutated quotation, stale source and invalid offsets", () => {
  const map = project();
  const candidate = proposeAbstractClaims(map.papers[0])[0];
  assert.throws(() => validateGroundedProposal(map, { ...candidate, excerpt: "Unsupported paraphrase fabricated by a model." }), /not an exact excerpt/);
  assert.throws(() => validateGroundedProposal(map, { ...candidate, start: -1 }), /Invalid source excerpt range/);
  assert.throws(() => validateGroundedProposal(map, { ...candidate, doi: "10.1234/fake" }), /no longer in this project/);
  assert.throws(() => validateGroundedProposal(map, { ...candidate, id: "forged" }), /identity/);
});

test("tampered origin metadata fails import without changing the saved project", () => {
  const map = project();
  const candidate = proposeAbstractClaims(map.papers[0])[0];
  const saved = approveGroundedProposal(map, candidate);
  const forged = JSON.parse(JSON.stringify(saved));
  forged.claims[0].origin.excerpt = "Fabricated quotation";
  assert.throws(() => parseAtlasProject(forged), /tampered/);
  forged.claims[0].origin = null;
  assert.throws(() => parseAtlasProject(forged), /tampered/);
  assert.equal(saved.claims[0].origin?.excerpt, candidate.excerpt);
});

test("does not propose unverifiable passages from absent or excessively long metadata", () => {
  const map = project();
  assert.deepEqual(proposeAbstractClaims({ ...map.papers[0], abstract: "" }), []);
  assert.deepEqual(proposeAbstractClaims({ ...map.papers[0], abstract: "Q".repeat(4001) }), []);
  assert.deepEqual(proposeAbstractClaims(map.papers[0], 0), []);
});

test("approving existing researcher-authored claim does not duplicate graph nodes", () => {
  const map = project();
  const candidate = proposeAbstractClaims(map.papers[0])[0];
  const existing = addAtlasClaim(map, candidate.claimText);
  const updated = approveGroundedProposal(existing, candidate);
  assert.equal(updated.claims.length, 1);
  assert.equal(updated.evidence.length, 0);
  assert.equal(updated.events.length, existing.events.length);
});
