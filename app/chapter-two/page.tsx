import type { Metadata } from "next";
import ChapterTwoClient from "./ChapterTwoClient";

export const metadata: Metadata = {
  title: "Chapter Two Research Studio",
  description: "Find DOI-registered scholarly articles and build evidence-bound conceptual, theoretical and empirical literature-review sections.",
};

export default function ChapterTwoPage() {
  return <ChapterTwoClient />;
}
