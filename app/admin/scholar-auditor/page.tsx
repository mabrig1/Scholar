import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import AuditorClient from "./AuditorClient";

export default async function ScholarAuditorPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <AuditorClient />;
}
