// middleware.ts (ที่ root)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAdmin = request.cookies.get("isAdmin")?.value === "true";
  // กันทั้ง /home และ /home/...
  if (!isAdmin && (request.nextUrl.pathname === "/home" || request.nextUrl.pathname.startsWith("/home/"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/home", "/home/:path*"] };
