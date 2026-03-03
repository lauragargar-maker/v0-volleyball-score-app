import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Routes that require authentication
const PROTECTED_ROUTES = ["/home", "/historial", "/solicitudes"]

// Routes that authenticated users should be redirected away from
const AUTH_ROUTES = ["/auth/login", "/auth/error"]

// Public routes that anyone can access (no redirects)
const PUBLIC_ROUTES = ["/", "/live"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Refresh session - this also handles token refresh automatically
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if the route is a live score page (public, no redirects)
  if (pathname.startsWith("/live/")) {
    return supabaseResponse
  }

  // Check if user is authenticated
  const isAuthenticated = !!user

  // If authenticated user visits landing page, redirect to home
  if (isAuthenticated && pathname === "/") {
    const redirectUrl = new URL("/home", request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated user visits auth routes, redirect to home
  if (isAuthenticated && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = new URL("/home", request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If unauthenticated user visits protected routes, redirect to login
  if (!isAuthenticated && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = new URL("/auth/login", request.url)
    // Save the original URL to redirect back after login
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
