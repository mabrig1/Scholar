import mongoose, { Schema } from "mongoose";
import { LECTURER_WORKFLOWS } from "@/lib/lecturer-agent";

const StepSchema = new Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, required: true },
  kind: { type: String, enum: ["ingest", "analyze", "prepare", "verify", "external-action"], required: true },
  requiresApproval: { type: Boolean, default: false },
  approvalLabel: String,
  status: { type: String, enum: ["planned", "ready", "awaiting-approval", "approved", "rejected", "completed"], default: "planned" },
  decisionNote: { type: String, maxlength: 2000 },
  decidedAt: Date,
}, { _id: false });

const EvidenceSchema = new Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["missing", "supplied", "verified"], default: "missing" },
  note: { type: String, maxlength: 1000 },
}, { _id: false });

const ActivitySchema = new Schema({
  event: { type: String, required: true, maxlength: 200 },
  actor: { type: String, enum: ["system", "lecturer"], default: "system" },
  detail: { type: String, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const LecturerAgentCaseSchema = new Schema({
  caseNumber: { type: String, required: true, unique: true, index: true },
  lecturerName: { type: String, required: true, trim: true, maxlength: 200 },
  institution: { type: String, required: true, trim: true, maxlength: 300 },
  department: { type: String, trim: true, maxlength: 300 },
  workflow: { type: String, enum: LECTURER_WORKFLOWS, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 500 },
  context: { type: String, trim: true, maxlength: 5000 },
  workloadCount: { type: Number, min: 0, max: 100_000, default: 0 },
  currency: { type: String, enum: ["NGN", "USD", "EUR", "GBP"], default: "NGN" },
  status: { type: String, enum: ["PLANNED", "AWAITING_APPROVAL", "REJECTED", "READY_FOR_INTEGRATION", "COMPLETED"], default: "AWAITING_APPROVAL", index: true },
  executionMode: { type: String, enum: ["review-gated"], default: "review-gated" },
  externalExecutionEnabled: { type: Boolean, default: false },
  steps: { type: [StepSchema], default: [] },
  evidence: { type: [EvidenceSchema], default: [] },
  activity: { type: [ActivitySchema], default: [] },
}, { timestamps: true });

export const LecturerAgentCase = mongoose.models.LecturerAgentCase || mongoose.model("LecturerAgentCase", LecturerAgentCaseSchema);
