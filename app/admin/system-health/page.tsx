import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import SystemHealthClient from "./SystemHealthClient";

export default async function SystemHealthPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <SystemHealthClient />;
}
