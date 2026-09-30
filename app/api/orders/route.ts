import { POST as createOrderV2 } from "./v2/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Backward-compatible order endpoint.
 * All order creation is routed through the hardened v2 validation and consent flow
 * so legacy clients cannot bypass current privacy, security or academic-integrity checks.
 */
export async function POST(request: Request) {
  return createOrderV2(request);
}
