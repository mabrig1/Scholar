import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import LecturerAgentClient from "./LecturerAgentClient";

export const dynamic = "force-dynamic";

export default async function LecturerAgentPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <LecturerAgentClient />;
}
