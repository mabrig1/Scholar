import assert from "node:assert/strict";
import test from "node:test";
import {
  auditGrounding,
  buildMissionPlan,
  normalizeMissionInput,
  scoreEvidence,
} from "../lib/agentic-research";
import type { ScholarlyArticle } from "../lib/scholarly-articles";

function article(overrides: Partial<ScholarlyArticle> = {}): ScholarlyArticle {
  return {
    doi: "10.1234/example",
    title: "Example article",
    authors: [{ given: "Ada", family: "Researcher" }],
    year: 2026,
    journal: "Journal of Examples",
    publisher: "Example Press",
    url: "https://doi.org/10.1234/example",
    abstract: "A".repeat(400),
    volume: "1",
    issue: "1",
    pages: "1-10",
    citationCount: 25,
    openAccess: true,
    openAlexId: "https://openalex.org/W1",
    retracted: false,
    verification: "crossref-openalex",
    ...overrides,
  };
}

test("normalizes mission limits and defaults", () => {
  const mission = normalizeMissionInput({
    topic: "  Digital governance and citizen trust  ",
    fromYear: 1800,
    toYear: 9999,
    maxSources: 99,
    missionType: "thesis",
  });

  assert.equal(mission.topic, "Digital governance and citizen trust");
  assert.equal(mission.fromYear, 1900);
  assert.equal(mission.maxSources, 20);
  assert.equal(mission.missionType, "thesis");
  assert.equal(mission.depth, "deep");
});

test("builds a stage-aware thesis mission plan", () => {
  const mission = normalizeMissionInput({
    topic: "Digital governance and citizen trust",
    missionType: "thesis",
    fromYear: 2021,
    toYear: 2026,
  });
  const plan = buildMissionPlan(mission);

  assert.equal(plan[0].agentId, "planner");
  assert.equal(plan.some((step) => step.agentId === "methods"), true);
  assert.equal(plan.at(-1)?.agentId, "integrity");
});

test("retracted evidence is forced into caution with zero score", () => {
  const scored = scoreEvidence(article({ retracted: true }));
  assert.equal(scored.evidenceScore, 0);
  assert.equal(scored.evidenceBand, "caution");
  assert.match(scored.scoreReasons[0], /Retraction/i);
});

test("dual-registry recent evidence receives a strong score", () => {
  const scored = scoreEvidence(article(), 2026);
  assert.equal(scored.evidenceBand, "strong");
  assert.ok(scored.evidenceScore >= 75);
});

test("grounding audit rejects unknown source IDs", () => {
  const audit = auditGrounding(
    "The evidence suggests a consistent pattern across the retrieved studies [S1].\n\nA second claim relies on an unknown citation token [S9].",
    3,
  );

  assert.deepEqual(audit.citedSourceIds, ["S1"]);
  assert.deepEqual(audit.unknownSourceIds, ["S9"]);
  assert.ok(audit.warnings.some((warning) => /Unknown source IDs/i.test(warning)));
});
