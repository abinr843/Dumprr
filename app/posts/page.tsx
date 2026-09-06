import { LayoutShell } from "@/components/layout/LayoutShell";
import { PostsManager } from "@/components/posts/PostsManager";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";

export const metadata = {
  title: "Posts — DUMPR",
  description: "Manage posts and announcements",
};

export default async function PostsPage() {
  const session = await getSession();
  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <PostsManager isAdmin={userIsAdmin} />
    </LayoutShell>
  );
}
