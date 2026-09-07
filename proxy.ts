import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// ─── Maintenance Mode Cache (30s TTL) ───────────────────────────────
let maintenanceCache: { value: boolean; expiresAt: number } | null = null;

async function isMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.value;
  }

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "app.maintenance_mode")
      .single();

    const enabled = data?.value === "true" || data?.value === true;
    maintenanceCache = { value: enabled, expiresAt: now + 30_000 };
    return enabled;
  } catch {
    // If we can't check, assume not in maintenance
    return false;
  }
}

/**
 * Next.js 16 Proxy function (formerly middleware).
 *
 * Handles:
 * 1. Session refresh on every request
 * 2. Signup route blocking (redirects to "Coming Soon")
 * 3. Unauthenticated user redirection to /login
 * 4. Authenticated user redirection away from /login
 * 5. Admin route protection
 * 6. Maintenance mode enforcement
 *
 * Performance: Skips expensive supabase.auth.getUser() network call
 * for purely public routes that don't require auth checks.
 * Maintenance mode check uses 30s in-memory cache to avoid DB calls.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Block signup routes → Coming Soon page ───
  const blockedSignupPaths = ["/register", "/create-account"];
  if (blockedSignupPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  // ─── 2. Auth callbacks and static assets pass through immediately ───
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request });
  }

  // ─── 3. Maintenance mode enforcement ───
  // Allow: /maintenance, /login, /api/auth, /admin paths, and static assets
  const maintenanceExempt = ["/maintenance", "/login", "/api/"];
  const isMaintenanceExempt =
    maintenanceExempt.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/admin");
  const isMaintenancePath = pathname === "/maintenance";

  if (!isMaintenanceExempt) {
    const maintenance = await isMaintenanceMode();
    if (maintenance) {
      // Non-exempt routes: redirect all users to /maintenance
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }

  // If user visits /maintenance but maintenance is OFF, redirect to home
  if (isMaintenancePath) {
    const maintenance = await isMaintenanceMode();
    if (!maintenance) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next({ request });
  }

  // ─── 4. Determine if this route actually needs auth checks ───
  const adminPaths = ["/admin", "/trash", "/audit-logs", "/users"];
  const isAdminPath = adminPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isLoginPath = pathname === "/login";

  // Routes that are purely public — no auth needed at all
  const purelyPublicPaths = [
    "/",
    "/files",
    "/posts",
    "/recent",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/privacy",
    "/terms",
    "/settings",
    "/maintenance",
  ];
  const isPurelyPublic = purelyPublicPaths.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );

  // Public API routes that don't need auth in middleware
  const isPublicApiRoute = pathname.startsWith("/api/") && !isAdminPath;

  // Skip expensive auth.getUser() for routes that don't need it
  const needsAuthCheck = isAdminPath || isLoginPath || (!isPurelyPublic && !isPublicApiRoute && !pathname.startsWith("/api/"));

  if (!needsAuthCheck) {
    // Public route — pass through without auth network call
    return NextResponse.next({ request });
  }

  // ─── 5. Refresh Supabase session (only for routes that need auth) ───
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

  // ─── 6. Authenticated user visiting /login → redirect to dashboard ───
  if (user && isLoginPath) {
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

  // ─── 7. Unauthenticated user visiting protected routes → /login ───
  if (!user && !isLoginPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─── 8. Admin route protection (/admin, /trash, /audit-logs, /users) ───
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
