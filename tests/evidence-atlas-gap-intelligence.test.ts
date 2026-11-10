import assert from "node:assert/strict";
import test from "node:test";
import {
  addAtlasClaim, addAtlasPaper, createAtlasProject, logAtlasSearch,
  recordAtlasEvidence, type AtlasProject,
} from "../packages/evidence-atlas-core/src/index";
import { analyzeAtlasGaps, renderAtlasGapReport } from "../packages/evidence-atlas-core/src/gap-intelligence";

const article = {
  doi: "10.5555/audit.2026.001", title: "Public administration and performance",
  year: 2026, journal: "Research Review", authors: [{ given: "A", family: "B" }],
  abstract: "A study reports that context affects the relationship between incentives and productivity.",
  verification: "crossref" as const, retracted: false,
};
function project() {
  return addAtlasClaim(
    createAtlasProject("Employee productivity research", "What does the evidence say about public sector performance?"),
    "Financial incentives improve employee productivity."
  );
}
function withPaper(input: AtlasProject, suffix: string, retracted = false) {
  return addAtlasPaper(input, { ...article, doi: "10.5555/audit.2026." + suffix, retracted });
}
function review(input: AtlasProject, paperId: string, stance: "supports"|"contradicts"|"mixed"|"unclear",
  basis: "abstract"|"full-text" = "full-text", notes = "Study population and model checked.", locator = "Table 4") {
  return recordAtlasEvidence(input, {
    claimId: input.claims[0].id, paperId, stance, basis,
    excerpt: "The source study reports a contextual relationship between incentives and productivity.",
    notes, locator,
  });
}

test("empty evidence map is not misrepresented as a scientific literature gap", () => {
  const map = project();
  const audit = analyzeAtlasGaps(map, "2026-11-10T13:00:00.000Z");
  assert.equal(audit.totals.papers, 0);
  assert.ok(audit.signals.some((s) => s.kind === "unreviewed-claim"));
  assert.ok(audit.signals.some((s) => s.kind === "no-search-log"));
  assert.ok(audit.caveats.join(" ").includes("never evidence"));
  assert.ok(renderAtlasGapReport(map, audit).includes("not confirmed scientific research gaps"));
});

test("search log and saving unassessed paper produce separate coverage signals", () => {
  let map = withPaper(project(), "001");
  map = logAtlasSearch(map, "incentives public performance", 15);
  const audit = analyzeAtlasGaps(map);
  assert.equal(audit.totals.searchEvents, 1);
  assert.equal(audit.totals.unassessedPapers, 1);
  assert.ok(!audit.signals.some((s) => s.kind === "no-search-log"));
  assert.deepEqual(audit.signals.find((s) => s.kind === "unreviewed-papers")?.paperIds, [map.papers[0].id]);
});

test("flags disagreement only with opposing eligible human classifications", () => {
  let map = withPaper(withPaper(project(), "001"), "002");
  map = review(map, map.papers[0].id, "supports");
  map = review(map, map.papers[1].id, "contradicts");
  const audit = analyzeAtlasGaps(map);
  const signal = audit.signals.find((s) => s.kind === "potential-disagreement");
  assert.ok(signal);
  assert.equal(signal?.assessmentIds.length, 2);
  assert.equal(signal?.paperIds.length, 2);
  assert.equal(audit.totals.assessedPapers, 2);
  assert.ok(!audit.signals.some((s) => s.kind === "abstract-only"));
  const report = renderAtlasGapReport(map, audit);
  assert.ok(report.includes("https://doi.org/10.5555/audit.2026.001"));
  assert.ok(report.includes("https://doi.org/10.5555/audit.2026.002"));
  assert.ok(report.includes("population"));
});

test("mixed, abstract-only and incomplete methodology produce transparent review prompts", () => {
  let map = withPaper(project(), "001");
  map = review(map, map.papers[0].id, "mixed", "abstract", "", "");
  const audit = analyzeAtlasGaps(map);
  assert.deepEqual(
    ["abstract-only", "uncertain-evidence", "missing-methods", "missing-locator"]
      .map((kind) => audit.signals.some((signal) => signal.kind === kind)), [true,true,true,true],
  );
  assert.equal(audit.totals.abstractOnly, 1);
  assert.equal(audit.totals.unresolved, 1);
  assert.ok(audit.signals.every((entry) => entry.id && entry.nextStep));
});

test("retraction metadata prevents false opposition and flags current record review", () => {
  let map = withPaper(withPaper(project(), "001"), "002", true);
  map = review(map, map.papers[0].id, "supports");
  map = review(map, map.papers[1].id, "contradicts");
  const audit = analyzeAtlasGaps(map);
  assert.equal(audit.totals.retractionSignals, 1);
  assert.ok(audit.signals.some((s) => s.kind === "retraction-flag"));
  assert.ok(!audit.signals.some((s) => s.kind === "potential-disagreement"));
});

test("a fully reviewed non-contradictory small corpus is never assigned false consensus", () => {
  let map = withPaper(withPaper(withPaper(project(), "001"), "002"), "003");
  for (const paper of map.papers) map = review(map, paper.id, "supports");
  map = logAtlasSearch(map, "productivity incentives", 3);
  const audit = analyzeAtlasGaps(map);
  assert.equal(audit.totals.unassessedPapers, 0);
  assert.ok(!audit.signals.some((s) => ["thin-evidence", "potential-disagreement", "abstract-only"].includes(s.kind)));
  assert.ok(!renderAtlasGapReport(map, audit).includes("100% consensus"));
});
