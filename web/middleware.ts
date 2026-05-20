import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login"];
const API_PREFIXES = ["/api/agent", "/api/session", "/api/graph"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public pages and backend proxy routes
  if (
    PUBLIC_PATHS.includes(pathname) ||
    API_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
