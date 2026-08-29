export const LECTURER_WORKFLOWS = [
  "grading",
  "grants",
  "supervision",
  "publication",
  "career",
] as const;

export type LecturerWorkflow = typeof LECTURER_WORKFLOWS[number];
export type WorkflowStepKind = "ingest" | "analyze" | "prepare" | "verify" | "external-action";

export type LecturerWorkflowStep = {
  id: string;
  label: string;
  description: string;
  kind: WorkflowStepKind;
  requiresApproval: boolean;
  approvalLabel?: string;
  status: "planned" | "ready" | "awaiting-approval";
};

export type LecturerWorkflowDefinition = {
  title: string;
  shortTitle: string;
  problem: string;
  outcome: string;
  evidence: string[];
  steps: Omit<LecturerWorkflowStep, "status">[];
};

export const LECTURER_WORKFLOW_DEFINITIONS: Record<LecturerWorkflow, LecturerWorkflowDefinition> = {
  grading: {
    title: "Autonomous Result Pipeline Agent",
    shortTitle: "Mass Grading & Results",
    problem: "Reduce the marking, computation and broadsheet burden for courses with hundreds or thousands of students.",
    outcome: "A rubric-bound marking pack, exception queue, validated result sheet and lecturer-approved portal package.",
    evidence: ["Instructor rubric and model answers", "Registered-student list", "CA and examination weighting", "University grading scale", "Broadsheet template"],
    steps: [
      { id: "grading-ingest", label: "Ingest and identify scripts", description: "Prepare OCR/vision intake, match matriculation numbers and quarantine unreadable or duplicate scripts.", kind: "ingest", requiresApproval: false },
      { id: "grading-calibrate", label: "Calibrate the rubric", description: "Score a sample set and compare agent recommendations with lecturer decisions before bulk processing.", kind: "verify", requiresApproval: true, approvalLabel: "Approve rubric calibration" },
      { id: "grading-score", label: "Prepare provisional scores", description: "Apply the approved rubric and send ambiguous, borderline and low-confidence answers to a human exception queue.", kind: "analyze", requiresApproval: false },
      { id: "grading-validate", label: "Validate results and broadsheet", description: "Check totals, weighting, missing scripts, duplicates, grade boundaries and broadsheet regulations.", kind: "verify", requiresApproval: false },
      { id: "grading-release", label: "Release final grades", description: "Freeze the final result version only after the lecturer reviews exceptions and signs the release gate.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve final grades" },
      { id: "grading-upload", label: "Upload to institutional portal", description: "Prepare a browser-execution package; portal writing remains disabled until separate lecturer approval and integration configuration.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve portal upload" },
    ],
  },
  grants: {
    title: "Grant Scraper & Proposal Agent",
    shortTitle: "Grants & Budgets",
    problem: "Track suitable Nigerian and international calls while reducing proposal-formatting and multi-currency budgeting work.",
    outcome: "A verified call brief, eligibility matrix, tailored proposal pack, budget workbook and lecturer-approved submission package.",
    evidence: ["Current academic CV", "Verified publications", "Funder call and guidelines", "Institutional costing rules", "Collaborator confirmations"],
    steps: [
      { id: "grant-monitor", label: "Configure opportunity monitoring", description: "Define fields, countries, funders, deadlines and eligibility filters for scheduled discovery adapters.", kind: "ingest", requiresApproval: false },
      { id: "grant-verify", label: "Verify the call", description: "Capture the official source, deadline, eligibility, documents, budget ceiling and submission route.", kind: "verify", requiresApproval: false },
      { id: "grant-draft", label: "Prepare tailored proposal", description: "Map verified lecturer evidence into the funder's sections without inventing publications, partners or results.", kind: "prepare", requiresApproval: false },
      { id: "grant-budget", label: "Build compliant budget", description: "Prepare line items, exchange-rate assumptions, justifications and an audit trail for human checking.", kind: "analyze", requiresApproval: false },
      { id: "grant-submit", label: "Submit grant application", description: "External submission remains locked until the lecturer confirms the final narrative, budget and attachments.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve grant submission" },
    ],
  },
  supervision: {
    title: "Thesis Audit & Supervision Agent",
    shortTitle: "Thesis Supervision",
    problem: "Audit large volumes of undergraduate and postgraduate chapter drafts consistently.",
    outcome: "A student-by-student diagnostic, evidence-linked correction queue and lecturer-approved feedback release.",
    evidence: ["Institutional thesis guide", "Approved proposal and objectives", "Current chapter drafts", "Reference list", "Ethics approval where required"],
    steps: [
      { id: "thesis-ingest", label: "Monitor draft intake", description: "Register new chapter versions from configured storage adapters and preserve version history.", kind: "ingest", requiresApproval: false },
      { id: "thesis-structure", label: "Audit structure and style", description: "Check headings, pagination, institutional format, citation-reference consistency and missing sections.", kind: "analyze", requiresApproval: false },
      { id: "thesis-method", label: "Audit methodological alignment", description: "Test alignment among problem, objectives, questions, design, population, sample, instruments and analysis.", kind: "verify", requiresApproval: false },
      { id: "thesis-integrity", label: "Run integrity review", description: "Attach similarity evidence and AI-writing indicators as review signals, never as automatic misconduct findings.", kind: "verify", requiresApproval: false },
      { id: "thesis-feedback", label: "Send student feedback", description: "Prepare prioritized actions for the student; outbound delivery remains locked for lecturer review.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve student feedback" },
    ],
  },
  publication: {
    title: "Publication Lifecycle Agent",
    shortTitle: "Publication Lifecycle",
    problem: "Reduce repetitive journal screening, manuscript reformatting, submission tracking and metadata maintenance.",
    outcome: "A verified journal shortlist, formatted manuscript package, tracked review record and lecturer-approved profile updates.",
    evidence: ["Final manuscript and figures", "Author contributions", "Ethics and funding statements", "Current journal guidelines", "ORCID and affiliation details"],
    steps: [
      { id: "publication-screen", label: "Screen target journals", description: "Verify official scope, indexing evidence, fees, retraction signals and publisher contact details.", kind: "verify", requiresApproval: false },
      { id: "publication-format", label: "Prepare journal package", description: "Reformat the manuscript, references, figures, declarations and cover letter to the verified guide.", kind: "prepare", requiresApproval: false },
      { id: "publication-submit", label: "Submit manuscript", description: "Portal form completion and final submission remain locked until every author and the lecturer approve.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve journal submission" },
      { id: "publication-track", label: "Track editorial stages", description: "Prepare status reminders, decision logs and response-to-reviewer workspaces from connected sources.", kind: "analyze", requiresApproval: false },
      { id: "publication-sync", label: "Update scholarly profiles", description: "Prepare DOI metadata updates for ORCID, Scopus and other profiles; profile writes require lecturer approval.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve scholarly-profile update" },
    ],
  },
  career: {
    title: "Academic Career Ledger Agent",
    shortTitle: "APER & Allowances",
    problem: "Capture promotion and allowance evidence continuously instead of rebuilding the record at year end.",
    outcome: "A year-round evidence ledger, APER-ready dossier, EAA calculation worksheet and lecturer-approved claim package.",
    evidence: ["Appointment and promotion records", "Teaching timetable and workload", "Committee appointment letters", "Supervision sign-offs", "Publication evidence", "Institutional APER/EAA rules"],
    steps: [
      { id: "career-index", label: "Index career evidence", description: "Register teaching, supervision, service, publications and awards with dates and source files.", kind: "ingest", requiresApproval: false },
      { id: "career-audit", label: "Audit evidence completeness", description: "Flag unsupported entries, duplicates, missing dates and items outside the appraisal period.", kind: "verify", requiresApproval: false },
      { id: "career-aper", label: "Prepare APER dossier", description: "Map verified ledger entries into the selected institutional appraisal structure.", kind: "prepare", requiresApproval: false },
      { id: "career-eaa", label: "Calculate allowance worksheet", description: "Apply administrator-entered institutional rules and retain the rule version and calculation trail.", kind: "analyze", requiresApproval: false },
      { id: "career-submit", label: "Submit appraisal or claim", description: "Form submission and board-facing claim packages remain locked until lecturer approval.", kind: "external-action", requiresApproval: true, approvalLabel: "Approve APER/EAA submission" },
    ],
  },
};

export function isLecturerWorkflow(value: unknown): value is LecturerWorkflow {
  return LECTURER_WORKFLOWS.includes(value as LecturerWorkflow);
}

export function buildLecturerWorkflowPlan(workflow: LecturerWorkflow) {
  const definition = LECTURER_WORKFLOW_DEFINITIONS[workflow];
  return definition.steps.map((step, index): LecturerWorkflowStep => ({
    ...step,
    status: step.requiresApproval ? "awaiting-approval" : index === 0 ? "ready" : "planned",
  }));
}

export function highStakesStepsAreApprovalGated(workflow: LecturerWorkflow) {
  return LECTURER_WORKFLOW_DEFINITIONS[workflow].steps
    .filter((step) => step.kind === "external-action")
    .every((step) => step.requiresApproval && Boolean(step.approvalLabel));
}

export function workflowReadiness(workflow: LecturerWorkflow, suppliedEvidence: string[]) {
  const required = LECTURER_WORKFLOW_DEFINITIONS[workflow].evidence;
  const normalized = new Set(suppliedEvidence.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const present = required.filter((item) => normalized.has(item.toLowerCase()));
  return {
    required,
    present,
    missing: required.filter((item) => !normalized.has(item.toLowerCase())),
    percentage: Math.round((present.length / required.length) * 100),
  };
}

export function lecturerCaseStatus(
  steps: Array<{ requiresApproval?: boolean; status?: string }>,
  evidence: Array<{ status?: string }> = [],
) {
  if (steps.some((step) => step.status === "rejected")) return "REJECTED";
  if (steps.every((step) => step.status === "completed" || (step.requiresApproval && step.status === "approved"))) {
    return evidence.some((item) => item.status !== "verified") ? "PLANNED" : "READY_FOR_INTEGRATION";
  }
  const nextIndex = steps.findIndex((step) => step.status !== "completed" && step.status !== "approved");
  return nextIndex >= 0 && steps[nextIndex]?.requiresApproval ? "AWAITING_APPROVAL" : "PLANNED";
}

export function approvalBlocker(
  steps: Array<{ status?: string }>,
  targetIndex: number,
  evidence: Array<{ status?: string }>,
) {
  if (steps.slice(0, targetIndex).some((step) => !["completed", "approved"].includes(String(step.status)))) {
    return "Complete every preceding workflow step before approving this gate.";
  }
  if (evidence.some((item) => item.status !== "verified")) {
    return "Verify every required evidence item before approving a high-stakes action.";
  }
  return null;
}
