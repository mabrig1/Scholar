import type { Metadata } from "next";
import PublishingAgentClient from "./PublishingAgentClient";

export const metadata: Metadata = {
  title: "Knowledge & Technical Publishing Agent | Mabrig Researcher Pro",
  description:
    "Build a manuscript-specific, low-cost journal publishing pathway with readiness checks, Scopus verification and a complete submission plan.",
};

export default function PublishingAgentPage() {
  return <PublishingAgentClient />;
}
