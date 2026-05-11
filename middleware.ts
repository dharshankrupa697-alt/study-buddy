import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/signup") ||
                     req.nextUrl.pathname.startsWith("/reset-password")

  // Check for supabase auth cookie
  const token = req.cookies.get("sb-access-token") ||
                req.cookies.getAll().find(c => c.name.includes("auth-token"))

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}