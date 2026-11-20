import type { Metadata } from "next";
import ManuscriptReviewClient from "./ManuscriptReviewClient";

export const metadata: Metadata = {
  title: "Manuscript Review",
  description: "Review methodology, statistics, citations, logic, ethics, reproducibility, novelty and writing with evidence-linked findings and a revision checklist.",
};
export default function ManuscriptReviewPage() { return <ManuscriptReviewClient />; }
