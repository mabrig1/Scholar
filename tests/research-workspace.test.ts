import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyResearchWorkspace,
  normalizeResearchWorkspace,
  researchWorkspaceProgress,
  workspacePublishingPrefill,
} from "../lib/research-workspace";

test("normalizes malformed workspace values safely", () => {
  const workspace = normalizeResearchWorkspace({ title: "  A useful title  ", abstract: 42, target: "scopus" });
  assert.equal(workspace.title, "A useful title");
  assert.equal(workspace.abstract, "");
  assert.equal(workspace.target, "scopus");
});

test("calculates a complete readiness profile", () => {
  const workspace = {
    ...emptyResearchWorkspace,
    title: "Digital governance and public service delivery",
    field: "Public Administration",
    abstract: "A".repeat(160),
    keywords: "governance, digitalisation, public service",
    target: "verified",
  };
  assert.deepEqual(researchWorkspaceProgress(workspace), {
    completed: 5,
    total: 5,
    percent: 100,
    checks: [
      { label: "Add a manuscript title", complete: true },
      { label: "Identify the research field", complete: true },
      { label: "Add an informative abstract", complete: true },
      { label: "Add 3–6 keywords", complete: true },
      { label: "Choose a publishing target", complete: true },
    ],
  });
});

test("maps workspace values into the publishing agent", () => {
  const prefill = workspacePublishingPrefill({ ...emptyResearchWorkspace, title: "Manuscript", budget: "low", target: "scopus" });
  assert.equal(prefill.title, "Manuscript");
  assert.equal(prefill.budget, "low");
  assert.equal(prefill.indexingGoal, "scopus");
});
