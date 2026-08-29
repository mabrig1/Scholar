import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalBlocker,
  buildLecturerWorkflowPlan,
  highStakesStepsAreApprovalGated,
  LECTURER_WORKFLOW_DEFINITIONS,
  LECTURER_WORKFLOWS,
  lecturerCaseStatus,
  workflowReadiness,
} from "../lib/lecturer-agent";

test("defines all five lecturer workflow agents", () => {
  assert.deepEqual(LECTURER_WORKFLOWS, ["grading", "grants", "supervision", "publication", "career"]);
  for (const workflow of LECTURER_WORKFLOWS) {
    assert.ok(LECTURER_WORKFLOW_DEFINITIONS[workflow].steps.length >= 5);
    assert.ok(LECTURER_WORKFLOW_DEFINITIONS[workflow].evidence.length >= 5);
  }
});

test("blocks premature approval until prerequisites and evidence are complete", () => {
  const steps = [
    { status: "ready" },
    { status: "awaiting-approval" },
  ];
  const evidence = [{ status: "supplied" }];
  assert.match(approvalBlocker(steps, 1, evidence) || "", /preceding workflow step/i);
  steps[0].status = "completed";
  assert.match(approvalBlocker(steps, 1, evidence) || "", /verify every required evidence/i);
  evidence[0].status = "verified";
  assert.equal(approvalBlocker(steps, 1, evidence), null);
});

test("does not mark a case integration-ready until every step is resolved", () => {
  assert.equal(lecturerCaseStatus([{ status: "completed" }, { requiresApproval: true, status: "awaiting-approval" }]), "AWAITING_APPROVAL");
  assert.equal(lecturerCaseStatus([{ status: "completed" }, { requiresApproval: true, status: "approved" }], [{ status: "verified" }]), "READY_FOR_INTEGRATION");
  assert.equal(lecturerCaseStatus([{ status: "completed" }, { requiresApproval: true, status: "approved" }], [{ status: "supplied" }]), "PLANNED");
  assert.equal(lecturerCaseStatus([{ status: "completed" }, { requiresApproval: true, status: "rejected" }]), "REJECTED");
});

test("gates every external action behind lecturer approval", () => {
  for (const workflow of LECTURER_WORKFLOWS) {
    assert.equal(highStakesStepsAreApprovalGated(workflow), true);
    const external = LECTURER_WORKFLOW_DEFINITIONS[workflow].steps.filter((step) => step.kind === "external-action");
    assert.ok(external.length > 0);
    assert.ok(external.every((step) => step.requiresApproval && step.approvalLabel));
  }
});

test("creates awaiting-approval states for high-stakes plan steps", () => {
  const plan = buildLecturerWorkflowPlan("grading");
  assert.equal(plan.find((step) => step.id === "grading-release")?.status, "awaiting-approval");
  assert.equal(plan.find((step) => step.id === "grading-upload")?.status, "awaiting-approval");
  assert.equal(plan.find((step) => step.id === "grading-ingest")?.status, "ready");
});

test("reports only exact supplied evidence as ready", () => {
  const supplied = ["Current academic CV", "Verified publications"];
  const readiness = workflowReadiness("grants", supplied);
  assert.equal(readiness.present.length, 2);
  assert.ok(readiness.missing.includes("Funder call and guidelines"));
  assert.equal(readiness.percentage, 40);
});
