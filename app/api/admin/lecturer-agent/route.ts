import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import {
  buildLecturerWorkflowPlan,
  approvalBlocker,
  isLecturerWorkflow,
  lecturerCaseStatus,
  LECTURER_WORKFLOW_DEFINITIONS,
  workflowReadiness,
} from "@/lib/lecturer-agent";
import { LecturerAgentCase } from "@/lib/lecturer-agent-model";

export const runtime = "nodejs";
export const maxDuration = 30;

function noStore(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...init?.headers, "Cache-Control": "private, no-store" },
  });
}

function clean(value: unknown, limit: number) {
  return String(value || "").trim().slice(0, limit);
}

function unresolvedPrerequisite(
  steps: Array<{ status?: string }>,
  targetIndex: number,
) {
  return steps.slice(0, targetIndex).find((step) => !["completed", "approved"].includes(String(step.status)));
}

export async function GET() {
  try {
    await connectMongoDB();
    const cases = await LecturerAgentCase.find()
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean()
      .exec();
    return noStore({ cases });
  } catch (error) {
    console.error("Lecturer Agent Hub cases failed", error);
    return noStore({ error: "Unable to load lecturer workflow cases." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 100_000) return noStore({ error: "Request is too large." }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 30);
    await connectMongoDB();

    if (action === "create") {
      if (!isLecturerWorkflow(body.workflow)) {
        return noStore({ error: "Choose a valid lecturer workflow." }, { status: 400 });
      }
      const lecturerName = clean(body.lecturerName, 200);
      const institution = clean(body.institution, 300);
      const title = clean(body.title, 500);
      if (!lecturerName || !institution || !title) {
        return noStore({ error: "Lecturer name, institution and case title are required." }, { status: 400 });
      }
      const rawCount = Number(body.workloadCount || 0);
      if (!Number.isFinite(rawCount) || rawCount < 0 || rawCount > 100_000) {
        return noStore({ error: "Workload count must be between 0 and 100,000." }, { status: 400 });
      }
      const suppliedEvidence = Array.isArray(body.suppliedEvidence)
        ? body.suppliedEvidence.map((item) => clean(item, 300)).filter(Boolean)
        : [];
      const readiness = workflowReadiness(body.workflow, suppliedEvidence);
      const evidence = readiness.required.map((name) => ({
        name,
        status: readiness.present.includes(name) ? "supplied" : "missing",
      }));
      const workflowTitle = LECTURER_WORKFLOW_DEFINITIONS[body.workflow].title;
      const created = await LecturerAgentCase.create({
        caseNumber: `LA-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        lecturerName,
        institution,
        department: clean(body.department, 300) || undefined,
        workflow: body.workflow,
        title,
        context: clean(body.context, 5000) || undefined,
        workloadCount: Math.floor(rawCount),
        currency: ["NGN", "USD", "EUR", "GBP"].includes(String(body.currency)) ? body.currency : "NGN",
        status: "PLANNED",
        executionMode: "review-gated",
        externalExecutionEnabled: false,
        steps: buildLecturerWorkflowPlan(body.workflow),
        evidence,
        activity: [{
          event: "Workflow case created",
          actor: "system",
          detail: `${workflowTitle} planned with ${readiness.percentage}% of required evidence supplied.`,
        }],
      });
      return noStore({ case: created.toObject(), readiness }, { status: 201 });
    }

    const caseId = clean(body.caseId, 100);
    if (!mongoose.Types.ObjectId.isValid(caseId)) {
      return noStore({ error: "A valid workflow case is required." }, { status: 400 });
    }
    const workflowCase = await LecturerAgentCase.findById(caseId);
    if (!workflowCase) return noStore({ error: "Workflow case not found." }, { status: 404 });

    if (action === "decide") {
      const stepId = clean(body.stepId, 100);
      const decision = clean(body.decision, 20);
      if (!["approved", "rejected"].includes(decision)) {
        return noStore({ error: "Decision must be approved or rejected." }, { status: 400 });
      }
      const stepIndex = workflowCase.steps.findIndex((item: { id?: string }) => item.id === stepId);
      const step = workflowCase.steps[stepIndex];
      if (!step || !step.requiresApproval) {
        return noStore({ error: "This step is not a lecturer approval gate." }, { status: 400 });
      }
      if (decision === "approved") {
        const blocker = approvalBlocker(workflowCase.steps, stepIndex, workflowCase.evidence);
        if (blocker) {
          return noStore({ error: blocker }, { status: 409 });
        }
      }
      step.status = decision;
      step.decisionNote = clean(body.note, 2000) || undefined;
      step.decidedAt = new Date();
      workflowCase.status = lecturerCaseStatus(workflowCase.steps, workflowCase.evidence);
      workflowCase.activity.unshift({
        event: decision === "approved" ? "Approval granted" : "Approval rejected",
        actor: "lecturer",
        detail: `${step.label}: ${step.decisionNote || "No decision note supplied."}`,
        at: new Date(),
      });
      await workflowCase.save();
      return noStore({ case: workflowCase.toObject() });
    }

    if (action === "complete-step") {
      const stepId = clean(body.stepId, 100);
      const stepIndex = workflowCase.steps.findIndex((item: { id?: string }) => item.id === stepId);
      const step = workflowCase.steps[stepIndex];
      if (!step || step.requiresApproval) {
        return noStore({ error: "Only non-approval preparation steps can be marked complete." }, { status: 400 });
      }
      const blocker = unresolvedPrerequisite(workflowCase.steps, stepIndex);
      if (blocker) {
        return noStore({ error: "Complete the preceding workflow step first." }, { status: 409 });
      }
      step.status = "completed";
      const next = workflowCase.steps[stepIndex + 1];
      if (next && !next.requiresApproval && next.status === "planned") next.status = "ready";
      workflowCase.status = lecturerCaseStatus(workflowCase.steps, workflowCase.evidence);
      workflowCase.activity.unshift({
        event: "Workflow step completed",
        actor: "lecturer",
        detail: step.label,
        at: new Date(),
      });
      await workflowCase.save();
      return noStore({ case: workflowCase.toObject() });
    }

    if (action === "evidence") {
      const evidenceName = clean(body.evidenceName, 300);
      const status = clean(body.status, 20);
      if (!["missing", "supplied", "verified"].includes(status)) {
        return noStore({ error: "Evidence status is invalid." }, { status: 400 });
      }
      const evidence = workflowCase.evidence.find((item: { name?: string }) => item.name === evidenceName);
      if (!evidence) return noStore({ error: "Evidence item not found." }, { status: 404 });
      evidence.status = status;
      evidence.note = clean(body.note, 1000) || undefined;
      workflowCase.status = lecturerCaseStatus(workflowCase.steps, workflowCase.evidence);
      workflowCase.activity.unshift({
        event: "Evidence status updated",
        actor: "lecturer",
        detail: `${evidence.name}: ${status}`,
        at: new Date(),
      });
      await workflowCase.save();
      return noStore({ case: workflowCase.toObject() });
    }

    return noStore({ error: "Unsupported lecturer-agent action." }, { status: 400 });
  } catch (error) {
    console.error("Lecturer Agent Hub action failed", error);
    return noStore({ error: "Unable to update the lecturer workflow." }, { status: 500 });
  }
}
