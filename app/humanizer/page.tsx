import type { Metadata } from "next";
import { configuredAiProviders } from "@/lib/ai-provider";
import ThesisHumanizerClient from "./ThesisHumanizerClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Evidence-Safe Thesis Humanizer",
  description: "Diagnose and improve thesis writing while protecting citations, numbers, headings, quotations, DOI links and the researcher’s intended meaning.",
};

export default function ThesisHumanizerPage() {
  const legacyConfigured = Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_BASE_URL?.trim() && process.env.AI_MODEL?.trim());
  return <ThesisHumanizerClient aiConfigured={legacyConfigured || configuredAiProviders().length > 0} />;
}
