import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import SubmissionReadinessClient from "./SubmissionReadinessClient";

export default async function SubmissionReadinessPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <SubmissionReadinessClient />;
}
