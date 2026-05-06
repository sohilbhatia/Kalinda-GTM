import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function withPathHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow login page and auth API
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return withPathHeader(request);
  }

  const session = request.cookies.get("kalinda_session");
  if (!session || session.value !== "authenticated") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return withPathHeader(request);
}

export const config = {
  matcher: [
    // Skip all `/_next/*` (RSC, chunks, HMR) so middleware never intercepts assets
    "/((?!_next/).*)",
  ],
};
