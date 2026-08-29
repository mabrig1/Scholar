import type { Metadata } from "next";
import "./globals.css";
import "./conversion.css";
import ClientOrderAssistant from "./components/ClientOrderAssistant";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://scholar.mabrigkorie.org"),
  title: {
    default: "Mabrig Researcher Pro",
    template: "%s | Mabrig Researcher Pro",
  },
  description: "Publishing intelligence, DocForge document formatting and responsible academic assistance in one research platform.",
  applicationName: "Mabrig Researcher Pro",
  keywords: ["research formatting", "academic publishing", "journal matching", "citation audit", "thesis formatting", "research assistance"],
  openGraph: {
    type: "website",
    title: "Mabrig Researcher Pro",
    description: "Research, format and publish with evidence-aware tools and human assistance.",
    siteName: "Mabrig Researcher Pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mabrig Researcher Pro",
    description: "Research, format and publish with evidence-aware tools and human assistance.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<ClientOrderAssistant /></body>
    </html>
  );
}
