import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import VisibilityPackClient from "./VisibilityPackClient";

export default async function VisibilityPackPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <VisibilityPackClient />;
}
