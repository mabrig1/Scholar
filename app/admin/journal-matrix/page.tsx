import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import JournalMatrixClient from "./JournalMatrixClient";

export default async function JournalMatrixPage() {
  if (!adminAuthConfigured()) redirect("/admin");
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <JournalMatrixClient />;
}
