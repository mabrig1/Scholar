import type { NextRequest } from "next/server";
import { POST as verify } from "@/src/app/api/journalguard/verify/route";

/** Active App Router entrypoint. The legacy src/app tree is not routed while app/ exists. */
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return verify(request);
}
