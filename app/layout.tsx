import type { Metadata } from "next";
import "./globals.css";
import "./conversion.css";
import ClientOrderAssistant from "./components/ClientOrderAssistant";

export const metadata: Metadata = {
  title: {
    default: "Mabrig Researcher Pro",
    template: "%s | Mabrig Researcher Pro",
  },
  description: "Publishing intelligence, DocForge document formatting and responsible academic assistance in one research platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<ClientOrderAssistant /></body>
    </html>
  );
}
