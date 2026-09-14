import type { Metadata } from "next";
import AcademicIndexingAgentClient from "./AcademicIndexingAgentClient";

export const metadata: Metadata = {
  title: "Academic Indexing Agent | Mabrig Researcher Pro",
  description:
    "A step-by-step Google Scholar indexing-readiness and academic discoverability workflow for postgraduate researchers and early-career lecturers.",
};

export default function AcademicIndexingAgentPage() {
  return <AcademicIndexingAgentClient />;
}
