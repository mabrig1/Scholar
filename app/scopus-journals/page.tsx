import type { Metadata } from "next";
import ScopusDirectoryClient from "./ScopusDirectoryClient";

export const metadata: Metadata = {
  title: "Scopus Journal Pathway | Mabrig Researcher Pro",
  description:
    "Explore a separate, cost-aware Scopus journal pathway with official verification steps, fee-route labels and manuscript matching support.",
};

export default function ScopusJournalsPage() {
  return <ScopusDirectoryClient />;
}
