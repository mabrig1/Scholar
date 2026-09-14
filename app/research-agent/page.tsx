import type { Metadata } from "next";
import ResearchAgentClient from "./ResearchAgentClient";

export const metadata: Metadata = {
  title: "Agentic Research OS | Mabrig Researcher Pro",
  description: "Run multi-step, evidence-grounded research missions with specialist agents for discovery, verification, synthesis, critique, integrity and publication handoffs.",
};

export default function ResearchAgentPage() {
  return <ResearchAgentClient />;
}
