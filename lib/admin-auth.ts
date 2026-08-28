/**
 * Compatibility helpers for the imported Researcher Pro tools.
 *
 * Researcher Pro protects every /admin and /api/admin route in middleware
 * using ADMIN_USERNAME and ADMIN_PASSWORD. These helpers deliberately return
 * true only when that protection is configured, avoiding a second cookie
 * login while keeping the original publishing modules unchanged.
 */
export const ADMIN_COOKIE = "researcher_pro_admin";

function configured() {
  return Boolean(
    process.env.ADMIN_USERNAME?.trim() && process.env.ADMIN_PASSWORD?.trim(),
  );
}

export function adminSessionToken() {
  return configured() ? "middleware-protected" : "";
}

export function adminAuthConfigured() {
  return configured();
}

export function verifyAdminKey() {
  return false;
}

export async function hasAdminSession() {
  return configured();
}

export function requestHasAdminSession(_request?: unknown) {
  return configured();
}
