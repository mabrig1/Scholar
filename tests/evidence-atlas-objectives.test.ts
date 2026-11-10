import assert from "node:assert/strict";
import test from "node:test";
import {
  addAtlasPaper, addAtlasClaim, createAtlasProject, parseAtlasProject, recordAtlasEvidence,
} from "../packages/evidence-atlas-core/src/index";
import {
  addAtlasObjective, updateAtlasObjective, removeAtlasObjective,
  analyzeObjectiveCoverage, renderObjectiveAlignmentReport,
} from "../packages/evidence-atlas-core/src/objective-alignment";

const article = {
  doi: "10.1234/objective.2026.003",
  title: "Public service training and administrative outcomes",
  journal: "Public Administration Research",
  year: 2026, authors: [{ given: "Amina", family: "Okafor" }],
  abstract: "Survey results investigate employee training and service outcomes.",
  verification: "crossref" as const, retracted: false,
};
function setup() {
  let project = createAtlasProject("Training and public service", "Does training influence public service delivery?");
  project = addAtlasPaper(project, article);
  project = addAtlasClaim(project, "Employee training is associated with improved service delivery.");
  return project;
}
const input = (claimIds: string[]) => ({
  objectiveText: "To examine the association between employee training and service delivery.",
  researchQuestion: "How does employee training relate to service delivery?",
  hypothesis: "There is no association between training and service delivery.",
  focusVariable: "Employee training",
  outcomeVariable: "Service delivery",
  claimIds,
});

test("aligns one measurable focus variable with exact stored claims, preserves old backups", () => {
  let project = setup();
  const oldBackup = JSON.parse(JSON.stringify(project));
  delete oldBackup.objectives;
  assert.deepEqual(parseAtlasProject(oldBackup).objectives, []);
  project = addAtlasObjective(project, input([project.claims[0].id]));
  assert.equal(project.objectives.length, 1);
  assert.equal(project.objectives[0].focusVariable, "Employee training");
  assert.equal(project.events.at(-1)?.action, "objective-added");
  const imported = parseAtlasProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(imported.objectives, project.objectives);
  assert.equal(analyzeObjectiveCoverage(imported, imported.objectives[0]).status, "no-reviewed-evidence");
});

test("coverage counts evidence from selected claims, not automatic statistics", () => {
  let project = setup();
  project = addAtlasObjective(project, input([project.claims[0].id]));
  project = recordAtlasEvidence(project, {
    claimId: project.claims[0].id,
    paperId: project.papers[0].id,
    stance: "mixed",
    basis: "abstract",
    excerpt: "The authors report a mixed association in the regional sample.",
    locator: "Abstract",
    notes: "Limited coverage.",
  });
  const coverage = analyzeObjectiveCoverage(project, project.objectives[0]);
  assert.equal(coverage.status, "abstract-only");
  assert.equal(coverage.reviewedSources, 1);
  assert.equal(coverage.abstractOnly, 1);
  assert.equal(coverage.mixed, 1);
  const report = renderObjectiveAlignmentReport(project, "2026-11-10T14:20:00Z");
  assert.ok(report.includes("https://doi.org/10.1234/objective.2026.003"));
  assert.ok(report.includes("not statistical hypothesis tests"));
  assert.ok(report.includes("Measurable focus variable: Employee training"));
});

test("revisions retain identity and audit trail; removal preserves original evidence", () => {
  let project = setup();
  project = addAtlasObjective(project, input([project.claims[0].id]));
  const id = project.objectives[0].id;
  const createdAt = project.objectives[0].createdAt;
  project = updateAtlasObjective(project, id, { ...input([]), hypothesis: "" });
  assert.equal(project.objectives[0].id, id);
  assert.equal(project.objectives[0].createdAt, createdAt);
  assert.equal(project.objectives[0].claimIds.length, 0);
  assert.equal(project.events.at(-1)?.action, "objective-revised");
  assert.equal(analyzeObjectiveCoverage(project, project.objectives[0]).status, "no-linked-claims");
  const evidence = project.evidence.length;
  project = removeAtlasObjective(project, id);
  assert.equal(project.objectives.length, 0);
  assert.equal(project.evidence.length, evidence);
  assert.equal(project.events.at(-1)?.action, "objective-removed");
});

test("invalid objectives and forged imported links fail closed", () => {
  let project = setup();
  assert.throws(() => addAtlasObjective(project, { ...input([]), focusVariable: "" }), /measurable focus variable/);
  assert.throws(() => addAtlasObjective(project, { ...input([]), outcomeVariable: "Employee training" }), /identical/);
  assert.throws(() => addAtlasObjective(project, input(["not-a-real-claim"])), /existing research claims/);
  project = addAtlasObjective(project, input([project.claims[0].id]));
  const forged = JSON.parse(JSON.stringify(project));
  forged.objectives[0].claimIds = ["not-a-real-claim"];
  assert.throws(() => parseAtlasProject(forged), /invalid or orphaned research objectives/);
  const duplicate = JSON.parse(JSON.stringify(project));
  duplicate.objectives.push(duplicate.objectives[0]);
  assert.throws(() => parseAtlasProject(duplicate), /invalid or orphaned research objectives/);
  const wrongShape = JSON.parse(JSON.stringify(project));
  wrongShape.objectives = "oops";
  assert.throws(() => parseAtlasProject(wrongShape), /invalid or orphaned research objectives/);
});
