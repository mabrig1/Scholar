import { NextRequest, NextResponse } from "next/server";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  let diff = 0;
  for (let index = 0; index < first.length; index += 1) diff |= first[index] ^ second[index];
  return diff === 0;
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (request.nextUrl.protocol === "https:" && process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/api/admin")) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}

function unauthorized(request: NextRequest) {
  const response = new NextResponse("Admin authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mabrig Researcher Pro Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
      "Vary": "Authorization",
    },
  });
  return applySecurityHeaders(response, request);
}

function forbidden(request: NextRequest) {
  return applySecurityHeaders(
    NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 }),
    request,
  );
}

function isStateChanging(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isAllowedBrowserOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set<string>([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // Ignore malformed configuration; same-origin remains allowed.
    }
  }

  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    isStateChanging(request.method) &&
    !isAllowedBrowserOrigin(request)
  ) {
    return forbidden(request);
  }

  const adminPath =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin");

  if (!adminPath) return applySecurityHeaders(NextResponse.next(), request);

  const adminUser = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminUser || !adminPassword) {
    return applySecurityHeaders(
      new NextResponse("Admin credentials are not configured.", { status: 503 }),
      request,
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized(request);

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return unauthorized(request);

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    const [usernameHash, configuredUserHash, passwordHash, configuredPasswordHash] = await Promise.all([
      sha256(username),
      sha256(adminUser),
      sha256(password),
      sha256(adminPassword),
    ]);

    if (
      !constantTimeEqual(usernameHash, configuredUserHash) ||
      !constantTimeEqual(passwordHash, configuredPasswordHash)
    ) {
      return unauthorized(request);
    }

    const response = NextResponse.next();
    response.headers.set("Vary", "Authorization");
    return applySecurityHeaders(response, request);
  } catch {
    return unauthorized(request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
