export const RESEARCH_WORKSPACE_STORAGE_KEY = "mabrig_research_workspace_v1";

export type ResearchWorkspace = {
  title: string;
  field: string;
  articleType: string;
  studyStage: string;
  abstract: string;
  keywords: string;
  institution: string;
  target: string;
  budget: string;
  updatedAt: string;
};

export const emptyResearchWorkspace: ResearchWorkspace = {
  title: "",
  field: "",
  articleType: "Original research article",
  studyStage: "draft",
  abstract: "",
  keywords: "",
  institution: "",
  target: "verified",
  budget: "zero",
  updatedAt: "",
};

const textFields: Array<keyof ResearchWorkspace> = [
  "title",
  "field",
  "articleType",
  "studyStage",
  "abstract",
  "keywords",
  "institution",
  "target",
  "budget",
  "updatedAt",
];

export function normalizeResearchWorkspace(value: unknown): ResearchWorkspace {
  if (!value || typeof value !== "object") return { ...emptyResearchWorkspace };
  const record = value as Record<string, unknown>;
  const normalized = { ...emptyResearchWorkspace };
  for (const field of textFields) {
    if (typeof record[field] === "string") normalized[field] = record[field].trim().slice(0, field === "abstract" ? 12_000 : 500);
  }
  return normalized;
}

export function researchWorkspaceProgress(workspace: ResearchWorkspace) {
  const checks = [
    { label: "Add a manuscript title", complete: workspace.title.length >= 12 },
    { label: "Identify the research field", complete: workspace.field.length >= 3 },
    { label: "Add an informative abstract", complete: workspace.abstract.length >= 120 },
    { label: "Add 3–6 keywords", complete: workspace.keywords.split(",").filter(Boolean).length >= 3 },
    { label: "Choose a publishing target", complete: Boolean(workspace.target) },
  ];
  const completed = checks.filter((check) => check.complete).length;
  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
    checks,
  };
}

export function workspacePublishingPrefill(workspace: ResearchWorkspace) {
  return {
    title: workspace.title,
    abstract: workspace.abstract,
    keywords: workspace.keywords,
    field: workspace.field,
    articleType: workspace.articleType || "Original research article",
    budget: workspace.budget || "zero",
    indexingGoal: workspace.target || "verified",
    studyStage: workspace.studyStage || "draft",
  };
}
