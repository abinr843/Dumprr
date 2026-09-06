"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdmin, hasMinimumRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallback?: React.ReactNode;
}

export function AuthGuard({
  children,
  requiredRole,
  fallback,
}: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
          return;
        }

        if (requiredRole) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          const role = (profile?.role ?? "member") as UserRole;

          if (requiredRole === "admin" || requiredRole === "superadmin") {
            if (!isAdmin(role)) {
              router.replace("/?error=access_denied");
              return;
            }
          } else if (!hasMinimumRole(role, requiredRole)) {
            router.replace("/?error=access_denied");
            return;
          }
        }

        setAuthorized(true);
      } catch (err) {
        console.error("AuthGuard verification error:", err);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, requiredRole]);

  if (loading) {
    return (
      fallback ?? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "50vh",
            gap: "var(--space-2)",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
          }}
        >
          <Loader2 size={20} className="spin" />
          <span>Verifying access…</span>
        </div>
      )
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
