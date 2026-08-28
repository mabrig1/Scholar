import { NextRequest, NextResponse } from "next/server";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function unauthorized() {
  return new NextResponse("Admin authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mabrig Print Shop Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export async function middleware(request: NextRequest) {
  const adminUser = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminUser || !adminPassword) {
    return new NextResponse("Admin credentials are not configured.", { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return unauthorized();

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    if (username !== adminUser) return unauthorized();

    const passwordHash = await sha256(password);
    const configuredPasswordHash = await sha256(adminPassword);
    if (passwordHash !== configuredPasswordHash) return unauthorized();

    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
