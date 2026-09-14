import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import ScopusStudioClient from "./ScopusStudioClient";

export default async function ScopusStudioPage(){
  if(!adminAuthConfigured()) redirect("/admin");
  if(!(await hasAdminSession())) redirect("/admin/login");
  return <ScopusStudioClient/>;
}
