import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import HighImpactClient from "./HighImpactClient";

export default async function HighImpactPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <HighImpactClient />;
}
