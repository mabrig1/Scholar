import { redirect } from "next/navigation";
import { adminAuthConfigured, hasAdminSession } from "@/lib/admin-auth";
import GoogleScholarStudioClient from "./GoogleScholarStudioClient";

export default async function GoogleScholarStudioPage(){
  if(!adminAuthConfigured()) redirect("/admin");
  if(!(await hasAdminSession())) redirect("/admin/login");
  return <GoogleScholarStudioClient/>;
}
