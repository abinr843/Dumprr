import { LayoutShell } from "@/components/layout/LayoutShell";
import { PostsManager } from "@/components/posts/PostsManager";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database.types";
import type { PostWithAuthor } from "@/types/posts";

export const metadata = {
  title: "Posts — DUMPR",
  description: "Manage posts and announcements",
};

export default async function PostsPage() {
  const adminClient = createAdminClient();

  // Parallelize session + initial published posts fetch
  const [session, postsResult] = await Promise.all([
    getSession(),
    adminClient
      .from("posts")
      .select("*, profiles:author_id(id, username, full_name, avatar_url)")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: false }),
  ]);

  const userIsAdmin = session?.profile
    ? isAdmin(session.profile.role as UserRole)
    : false;

  // Normalize posts to match PostWithAuthor shape (same as /api/posts response)
  // The API returns the joined profile under the "profiles" key — we remap to "author"
  const initialPosts: PostWithAuthor[] = (postsResult.data || []).map((p) => {
    const profile = p.profiles as unknown as {
      id: string;
      username: string;
      full_name: string;
      avatar_url: string;
    } | null;
    return {
      ...(p as unknown as PostWithAuthor),
      author: profile || null,
    };
  });

  return (
    <LayoutShell userEmail={session?.user?.email} userRole={session?.profile?.role}>
      <PostsManager isAdmin={userIsAdmin} initialPosts={initialPosts} />
    </LayoutShell>
  );
}
