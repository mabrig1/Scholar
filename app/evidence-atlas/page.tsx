import type { Metadata } from "next";
import EvidenceAtlasClient from "./EvidenceAtlasClient";

export const metadata: Metadata = {
  title: "Evidence Atlas | MABRIG Scholar",
  description: "Map DOI-backed literature to precise research claims with human-reviewed source passages, contradiction notes and exportable research history.",
};

export default function EvidenceAtlasPage() {
  return <EvidenceAtlasClient />;
}
