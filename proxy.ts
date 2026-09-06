import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 Proxy function (formerly middleware).
 *
 * Handles:
 * 1. Session refresh on every request
 * 2. Signup route blocking (redirects to "Coming Soon")
 * 3. Unauthenticated user redirection to /login
 * 4. Authenticated user redirection away from /login
 * 5. Admin route protection
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Block signup routes → Coming Soon page ───
  const blockedSignupPaths = ["/register", "/create-account"];
  if (blockedSignupPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  // ─── 2. Refresh Supabase session ───
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── 3. Public routes — no auth required (public file-sharing & announcements) ───
  const publicPaths = [
    "/",
    "/files",
    "/posts",
    "/recent",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/health",
  ];
  const isPublicPath = publicPaths.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthCallback = pathname.startsWith("/api/auth/");

  if (isAuthCallback) {
    // Auth callbacks must pass through
    return supabaseResponse;
  }

  // ─── 4. Authenticated user visiting /login → redirect to dashboard ───
  if (user && pathname === "/login") {
    // Fetch profile to determine role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === "abinrphilip34@gmail.com" ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    const role = profile?.role ?? (isAdminUser ? "superadmin" : "member");
    const redirectUrl =
      role === "admin" || role === "superadmin" ? "/admin" : "/";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // ─── 5. Unauthenticated user visiting protected routes (e.g. /settings, /admin) → /login ───
  if (!user && !isPublicPath && !isApiRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── 6. Admin route protection (/admin, /trash, /audit-logs, /users) ───
  const adminPaths = ["/admin", "/trash", "/audit-logs", "/users"];
  const isAdminPath = adminPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isAdminPath) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdminUser =
      user.email?.toLowerCase() === "abinrphilip34@gmail.com" ||
      user.user_metadata?.role === "superadmin" ||
      user.user_metadata?.role === "admin";

    const role = profile?.role ?? (isAdminUser ? "superadmin" : undefined);
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.redirect(
        new URL("/?error=access_denied", request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Public static assets (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
