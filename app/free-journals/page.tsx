import type { Metadata } from "next";
import DirectoryClient from "./DirectoryClient";

export const metadata: Metadata = {
  title: "100 Journal Candidates | Mabrig Researcher Pro",
  description:
    "Explore a curated, evidence-aware directory of open-access, zero-fee, conditional, repository and recheck-required academic publishing options.",
};

export default function FreeJournalsPage() {
  return <DirectoryClient />;
}
