import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import CitationAuditorClient from "./CitationAuditorClient";

export default async function CitationAuditorPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <CitationAuditorClient />;
}
