import type { Metadata } from "next";
import ChapterFourClient from "./ChapterFourClient";

export const metadata: Metadata = {
  title: "Chapter Four Data Analysis Lab",
  description: "Analyze thesis data with descriptive statistics, Likert summaries, reliability, correlation, chi-square and regression, then export a Word-ready Chapter Four report.",
};

export default function ChapterFourPage() {
  return <ChapterFourClient />;
}
