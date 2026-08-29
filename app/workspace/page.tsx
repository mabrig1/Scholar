import type { Metadata } from "next";
import WorkspaceClient from "./WorkspaceClient";

export const metadata: Metadata = {
  title: "Manuscript Workspace",
  description: "Save a manuscript profile once and carry it through formatting, publishing intelligence and human research support.",
};

export default function WorkspacePage() {
  return <WorkspaceClient />;
}
