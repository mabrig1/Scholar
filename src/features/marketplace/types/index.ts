export const ACADEMIC_TOOLS = [
  "R",
  "Python",
  "SPSS",
  "NVivo",
  "LaTeX",
  "Zotero",
] as const;

export const CITATION_STYLES = ["APA 7th", "IEEE", "Chicago"] as const;

export type AcademicTool = (typeof ACADEMIC_TOOLS)[number];
export type CitationStyle = (typeof CITATION_STYLES)[number];
export type ProjectStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";
export type MilestoneStatus = "pending" | "submitted" | "approved";

export type RAProfile = {
  id: string;
  userId: string;
  bio: string;
  academicLevel: string;
  disciplines: string[];
  toolset: AcademicTool[];
  citationStyles: CitationStyle[];
  hourlyRate: number;
};

export type ResearchProject = {
  id: string;
  userId: string;
  title: string;
  description: string;
  grantCode: string | null;
  targetJournal: string | null;
  budget: number;
  status: ProjectStatus;
};

export type ProjectMilestone = {
  id: string;
  researchProjectId: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
  dueDate: string | null;
};
