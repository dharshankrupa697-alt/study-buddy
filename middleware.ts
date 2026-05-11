import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  // If not logged in and trying to access protected pages → redirect to login
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/signup") ||
                     req.nextUrl.pathname.startsWith("/reset-password")

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // If logged in and trying to access auth pages → redirect to dashboard
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return res
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}