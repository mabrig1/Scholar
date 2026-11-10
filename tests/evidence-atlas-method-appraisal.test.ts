import assert from "node:assert/strict";
import test from "node:test";
import {
  addAtlasClaim, addAtlasPaper, createAtlasProject, parseAtlasProject, recordAtlasEvidence,
} from "../packages/evidence-atlas-core/src/index";
import {
  assessAppraisalReadiness, compareOpposingAtlasEvidence,
  isValidMethodAppraisal, recordMethodAppraisal,
  type AtlasMethodAppraisalInput,
} from "../packages/evidence-atlas-core/src/method-appraisal";

const article = {
  doi: "10.1234/methods.2026.11", title: "Contextual motivation and performance",
  year: 2026, journal: "Research Journal", authors: [{ given: "A", family: "B" }],
  abstract: "The literature suggests that context may affect employee motivation and performance.",
  verification: "crossref" as const, retracted: false,
};
const appraisal: AtlasMethodAppraisalInput = {
  studyDesign: "cross-sectional",
  setting: "Nigeria",
  population: "Public service employees",
  sampleSize: 310,
  samplingMethod: "non-probability",
  outcomeMeasure: "Employee performance on a five-point scale",
  effectEstimate: "Not reported",
  uncertainty: "Not reported",
  methodsLocator: "Methods §3 and Table 4",
  selectionBias: "potential-concern",
  confounding: "not-reviewed",
  measurementBias: "not-reviewed",
  missingData: "not-reviewed",
  limitations: "Interpret correlational findings cautiously.",
  sourceReviewed: true,
};
function setup(basis: "abstract" | "full-text" = "full-text") {
  let map = createAtlasProject("Methods review", "Does motivation influence public-sector performance?");
  map = addAtlasPaper(map, article);
  map = addAtlasClaim(map, "Financial incentives may be associated with public-sector performance.");
  map = recordAtlasEvidence(map, {
    claimId: map.claims[0].id, paperId: map.papers[0].id,
    stance: "supports", basis,
    excerpt: "The authors report an association between motivation and employee performance.",
    locator: basis === "abstract" ? "Abstract" : "Results §4", notes: "",
  });
  return map;
}

test("methodological appraisal is version-compatible and tied to an assessed source", () => {
  let map = setup();
  const id = map.evidence[0].id;
  map = recordMethodAppraisal(map, id, appraisal);
  const original = map.evidence[0].appraisal;
  assert.ok(isValidMethodAppraisal(original));
  assert.equal(original?.sampleSize, 310);
  assert.equal(map.events.at(-1)?.action, "method-appraisal-recorded");
  assert.equal(assessAppraisalReadiness(map.evidence[0]).status, "context-recorded");
  const roundTrip = parseAtlasProject(JSON.parse(JSON.stringify(map)));
  assert.equal(roundTrip.evidence[0].appraisal?.methodsLocator, "Methods §3 and Table 4");
  const old = setup();
  assert.equal(parseAtlasProject(JSON.parse(JSON.stringify(old))).evidence[0].appraisal, undefined);
});

test("abstract-only notes remain provisional regardless of recorded design", () => {
  const map = setup("abstract");
  const appraised = recordMethodAppraisal(map, map.evidence[0].id, appraisal);
  const readiness = assessAppraisalReadiness(appraised.evidence[0]);
  assert.equal(readiness.status, "abstract-preliminary");
  assert.ok(readiness.caveats.some((c) => c.includes("Abstract-only")));
});

test("claim reclassification or source passage change clears a stale appraisal", () => {
  const map = setup();
  const id = map.evidence[0].id;
  const updated = recordMethodAppraisal(map, id, appraisal);
  const item = updated.evidence[0];
  const revised = recordAtlasEvidence(updated, {
    claimId: item.claimId, paperId: item.paperId, stance: "contradicts",
    basis: item.basis, excerpt: item.excerpt, locator: item.locator, notes: "Re-reviewed source.",
  });
  assert.equal(revised.evidence[0].appraisal, undefined);
  assert.equal(assessAppraisalReadiness(revised.evidence[0]).status, "not-appraised");
});

test("bad appraisals are rejected on recording and JSON reimport", () => {
  const map = setup();
  assert.throws(() => recordMethodAppraisal(map, map.evidence[0].id, { ...appraisal, sourceReviewed: false }), /Confirm/);
  assert.throws(() => recordMethodAppraisal(map, map.evidence[0].id, { ...appraisal, methodsLocator: "" }), /locator/);
  assert.throws(() => recordMethodAppraisal(map, "nonexistent", appraisal), /existing assessed/);
  assert.throws(() => recordMethodAppraisal(map, map.evidence[0].id, { ...appraisal, sampleSize: -4 }), /Review/);
  const appraised = recordMethodAppraisal(map, map.evidence[0].id, appraisal);
  const forged = JSON.parse(JSON.stringify(appraised));
  forged.evidence[0].appraisal.selectionBias = "risk-proven-zero";
  assert.throws(() => parseAtlasProject(forged), /orphaned|unsupported/);
  const changed = JSON.parse(JSON.stringify(appraised));
  changed.evidence[0].appraisal.outcomeMeasure = "X".repeat(500);
  assert.throws(() => parseAtlasProject(changed), /orphaned|unsupported/);
});

test("opposing classifications identify missing methods rather than assert contradiction", () => {
  let map = setup();
  map = addAtlasPaper(map, { ...article, doi: "10.1234/methods.2026.12", title: "Incentives and measured work performance" });
  map = recordAtlasEvidence(map, {
    claimId: map.claims[0].id, paperId: map.papers[1].id,
    stance: "contradicts", basis: "full-text",
    excerpt: "The source reported a null relationship for a different measure of performance.",
    locator: "Table 4", notes: "",
  });
  let flags = compareOpposingAtlasEvidence(map, map.claims[0].id);
  assert.equal(flags.length, 1);
  assert.ok(flags[0].kinds.includes("methods-unreported"));
  map = recordMethodAppraisal(map, map.evidence[0].id, appraisal);
  map = recordMethodAppraisal(map, map.evidence[1].id, {
    ...appraisal, studyDesign: "cohort", outcomeMeasure: "Employment retention at 12 months",
    methodsLocator: "Methods §2",
  });
  flags = compareOpposingAtlasEvidence(map, map.claims[0].id);
  assert.ok(flags[0].kinds.includes("design-difference"));
  assert.ok(flags[0].kinds.includes("outcome-difference"));
  assert.equal(flags[0].kinds.includes("methods-unreported"), false);
  const otherClaim = addAtlasClaim(map, "Another explicit claim about the same field.");
  assert.deepEqual(compareOpposingAtlasEvidence(otherClaim, otherClaim.claims.at(-1)!.id), []);
});

test("retracted studies cannot create spurious inter-study comparability warnings", () => {
  let map = setup();
  map = addAtlasPaper(map, { ...article, doi: "10.1234/methods.2026.13", retracted: true });
  map = recordAtlasEvidence(map, {
    claimId: map.claims[0].id, paperId: map.papers[1].id,
    stance: "contradicts", basis: "abstract",
    excerpt: "The retracted study appears to report a conflicting outcome in its abstract.",
    locator: "Abstract", notes: "",
  });
  assert.deepEqual(compareOpposingAtlasEvidence(map, map.claims[0].id), []);
});
