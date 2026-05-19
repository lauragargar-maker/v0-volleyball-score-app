import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_ROUTES = ["/home", "/historial", "/solicitudes", "/club", "/clubs", "/onboarding"]
const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/error"]
const ONBOARDING_EXEMPT = ["/onboarding", "/clubs/new", "/clubs/join", "/auth"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365,
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/live/")) {
    return supabaseResponse
  }

  // Legacy paths -> new equivalents
  if (pathname === "/solicitar-acceso") {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }
  if (pathname === "/solicitudes") {
    return NextResponse.redirect(new URL("/club/requests", request.url))
  }

  const isAuthenticated = !!user

  if (isAuthenticated && pathname === "/") {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  if (isAuthenticated && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  if (!isAuthenticated && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const redirectUrl = new URL("/auth/login", request.url)
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Membership gate: authenticated users with no memberships go to /onboarding.
  if (isAuthenticated && !ONBOARDING_EXEMPT.some((r) => pathname.startsWith(r))) {
    const { count: membershipCount } = await supabase
      .from("club_members")
      .select("club_id", { count: "exact", head: true })
      .eq("user_id", user!.id)

    if ((membershipCount ?? 0) === 0) {
      const { count: pendingCount } = await supabase
        .from("club_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "pending")

      const target = (pendingCount ?? 0) > 0 ? "/onboarding/pending" : "/onboarding"
      return NextResponse.redirect(new URL(target, request.url))
    }
  }

  return supabaseResponse
}
