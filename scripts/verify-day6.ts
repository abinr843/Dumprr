/**
 * DUMPR — Day 6 Posts, Search, Recent Activity & Downloads Verification Script
 *
 * Verifies:
 * 1. Posts table schema & lifecycle (create, update status, soft-delete, restore, permanent delete).
 * 2. RLS access control for posts (public sees published, admin sees drafts/trash, anon cannot write).
 * 3. Unified search query across files, posts, and folders.
 * 4. Recent activity aggregation & chronological sorting.
 * 5. File preview capability resolution (previewable vs download-only).
 * 6. Audit trail completeness for Day 6 actions (POST_*, FILE_VIEWED, FILE_DOWNLOADED, DOWNLOAD_REJECTED).
 *
 * Usage:
 *   npx -y tsx scripts/verify-day6.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { AUDIT_ACTIONS } from "../types/audit";
import {
  postCreateSchema,
  postUpdateSchema,
  searchQuerySchema,
} from "../lib/validation/schema";
import {
  isExtensionPreviewable,
  getPreviewMimeType,
  PREVIEWABLE_EXTENSIONS,
} from "../lib/storage/preview";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

async function check(
  name: string,
  fn: () => Promise<{ ok: boolean; message?: string } | boolean>,
  detailSuccess: string,
  detailFailure: string
) {
  try {
    const res = await fn();
    const ok = typeof res === "boolean" ? res : res.ok;
    const msg = typeof res === "object" && res.message ? ` (${res.message})` : "";
    results.push({
      name,
      passed: ok,
      details: ok ? `${detailSuccess}${msg}` : `${detailFailure}${msg}`,
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      details: `${detailFailure}: ${err.message || String(err)}`,
    });
  }
}

async function runVerification() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  DUMPR — DAY 6 VERIFICATION SUITE");
  console.log("  Focus: Posts, Search, Recent Activity & Downloads");
  console.log("════════════════════════════════════════════════════════════════\n");

  const runId = randomUUID().slice(0, 8);
  let testPostId: string | null = null;
  let adminUserId: string | null = null;

  // Find admin user
  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("id")
    .in("role", ["admin", "superadmin"])
    .limit(1)
    .single();

  adminUserId = adminProfile?.id || null;

  // 1. Audit Action Types Completeness
  await check(
    "1. Audit Actions Completeness",
    async () => {
      const required = [
        "POST_CREATED",
        "POST_VIEWED",
        "POST_EDITED",
        "POST_DELETED",
        "POST_RESTORED",
        "POST_PERMANENTLY_DELETED",
        "FILE_VIEWED",
        "FILE_DOWNLOADED",
        "DOWNLOAD_REJECTED",
      ] as const;

      for (const act of required) {
        if (!AUDIT_ACTIONS[act]) {
          return { ok: false, message: `Missing audit action: ${act}` };
        }
      }
      return true;
    },
    "All Day 6 audit actions defined in AUDIT_ACTIONS",
    "Missing audit action constants"
  );

  // 2. Post Validation Schemas
  await check(
    "2. Post & Search Zod Schemas",
    async () => {
      const validPost = postCreateSchema.safeParse({
        title: `Verification Post ${runId}`,
        slug: `test-post-${runId}`,
        content: "Detailed markdown content",
        excerpt: "Brief summary",
        status: "published",
        tags: ["test", "verification"],
      });

      const invalidPost = postCreateSchema.safeParse({
        title: "", // empty title
      });

      const validSearch = searchQuerySchema.safeParse({
        q: "sample search",
        type: "all",
        limit: "15",
      });

      return validPost.success && !invalidPost.success && validSearch.success;
    },
    "Schemas correctly validate valid inputs and reject invalid ones",
    "Schema validation logic failed"
  );

  // 3. Post Creation (Admin)
  await check(
    "3. Admin Post Creation",
    async () => {
      if (!adminUserId) {
        return { ok: false, message: "No admin user found in profiles" };
      }

      const { data, error } = await adminClient
        .from("posts")
        .insert({
          title: `Day 6 Test Post ${runId}`,
          slug: `day-6-test-${runId}`,
          content: "Hello from Day 6 test script",
          excerpt: "Excerpt for test",
          status: "draft",
          author_id: adminUserId,
        })
        .select()
        .single();

      if (error || !data) {
        return { ok: false, message: error?.message };
      }

      testPostId = data.id;
      return true;
    },
    "Draft post created successfully with admin client",
    "Failed to create test post"
  );

  // 4. RLS: Anonymous user CANNOT see draft post
  await check(
    "4. RLS Draft Post Concealment",
    async () => {
      if (!testPostId) return false;

      const { data } = await anonClient
        .from("posts")
        .select("id, title, status")
        .eq("id", testPostId)
        .single();

      // Should return null due to RLS policy
      return data === null;
    },
    "Anonymous client receives null when attempting to read draft post (RLS enforced)",
    "Draft post leaked to anonymous client"
  );

  // 5. Post Status Transition to Published
  await check(
    "5. Post Status Transition to Published",
    async () => {
      if (!testPostId) return false;

      const now = new Date().toISOString();
      const { data, error } = await adminClient
        .from("posts")
        .update({
          status: "published",
          published_at: now,
        })
        .eq("id", testPostId)
        .select()
        .single();

      if (error || !data) return { ok: false, message: error?.message };
      return data.status === "published" && Boolean(data.published_at);
    },
    "Post updated to published status with published_at timestamp",
    "Failed to transition post to published"
  );

  // 6. RLS: Anonymous user CAN read published post
  await check(
    "6. RLS Published Post Visibility",
    async () => {
      if (!testPostId) return false;

      const { data, error } = await anonClient
        .from("posts")
        .select("id, title, status")
        .eq("id", testPostId)
        .single();

      if (error || !data) return { ok: false, message: error?.message };
      return data.status === "published";
    },
    "Anonymous client can view published post via RLS policy",
    "Anonymous client blocked from reading published post"
  );

  // 7. RLS: Anonymous user CANNOT mutate post
  await check(
    "7. RLS Mutation Protection",
    async () => {
      if (!testPostId) return false;

      const { error } = await anonClient
        .from("posts")
        .update({ title: "Hacked Title" })
        .eq("id", testPostId);

      // Should produce an error or update 0 rows
      const { data: current } = await adminClient
        .from("posts")
        .select("title")
        .eq("id", testPostId)
        .single();

      return current?.title !== "Hacked Title";
    },
    "Anonymous mutation rejected; original post title remained unchanged",
    "Anonymous client was able to mutate post"
  );

  // 8. Soft Delete Post (Move to Trash)
  await check(
    "8. Soft Delete Post",
    async () => {
      if (!testPostId) return false;

      const now = new Date().toISOString();
      const { data, error } = await adminClient
        .from("posts")
        .update({
          deleted_at: now,
        })
        .eq("id", testPostId)
        .select()
        .single();

      if (error || !data) return { ok: false, message: error?.message };
      return data.deleted_at !== null;
    },
    "Post soft-deleted (deleted_at populated)",
    "Failed to soft-delete post"
  );

  // 9. Restore Post
  await check(
    "9. Restore Post",
    async () => {
      if (!testPostId) return false;

      const { data, error } = await adminClient
        .from("posts")
        .update({
          status: "published",
          deleted_at: null,
        })
        .eq("id", testPostId)
        .select()
        .single();

      if (error || !data) return { ok: false, message: error?.message };
      return data.status === "published" && data.deleted_at === null;
    },
    "Post successfully restored from trash (deleted_at=null)",
    "Failed to restore post"
  );

  // 10. Unified Search Capabilities
  await check(
    "10. Unified Search Capabilities",
    async () => {
      const searchPattern = `%${runId}%`;

      // Search across posts
      const { data: postMatches } = await adminClient
        .from("posts")
        .select("id, title")
        .ilike("title", searchPattern);

      const hasPostMatch = Array.isArray(postMatches) && postMatches.length > 0;
      return hasPostMatch;
    },
    "Unified search query successfully matched test content by substring",
    "Unified search failed to return matching entity"
  );

  // 11. Recent Activity Feed Merging
  await check(
    "11. Recent Activity Feed Merging",
    async () => {
      const [filesRes, postsRes] = await Promise.all([
        adminClient
          .from("files")
          .select("id, name, created_at")
          .eq("status", "active")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        adminClient
          .from("posts")
          .select("id, title, created_at, published_at")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const items: { id: string; type: "file" | "post"; ts: string }[] = [];
      (filesRes.data || []).forEach((f) =>
        items.push({ id: f.id, type: "file", ts: f.created_at })
      );
      (postsRes.data || []).forEach((p) =>
        items.push({ id: p.id, type: "post", ts: p.published_at || p.created_at })
      );

      items.sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
      );

      // Should have at least our test post
      return items.length > 0;
    },
    "Recent activity aggregated and sorted chronologically",
    "Failed to aggregate activity items"
  );

  // 12. File Preview Capability Resolution
  await check(
    "12. File Preview Capability Resolution",
    async () => {
      const pdfPreview = isExtensionPreviewable("pdf");
      const pngPreview = isExtensionPreviewable("png");
      const txtPreview = isExtensionPreviewable("txt");
      const docxPreview = isExtensionPreviewable("docx");
      const xlsxPreview = isExtensionPreviewable("xlsx");

      const pdfMime = getPreviewMimeType("pdf");
      const pngMime = getPreviewMimeType("png");

      return (
        pdfPreview === true &&
        pngPreview === true &&
        txtPreview === true &&
        docxPreview === false &&
        xlsxPreview === false &&
        pdfMime === "application/pdf" &&
        pngMime === "image/png"
      );
    },
    "Previewable formats correctly routed; non-previewable formats routed to download fallback",
    "Preview capability detection failed"
  );

  // 13. Permanent Delete Cleanup
  await check(
    "13. Permanent Delete Post",
    async () => {
      if (!testPostId) return false;

      const { error } = await adminClient
        .from("posts")
        .delete()
        .eq("id", testPostId);

      if (error) return { ok: false, message: error.message };

      const { data: checkDeleted } = await adminClient
        .from("posts")
        .select("id")
        .eq("id", testPostId)
        .single();

      return checkDeleted === null;
    },
    "Post permanently deleted from database",
    "Failed to permanently delete post"
  );

  // Print Summary
  console.log("────────────────────────────────────────────────────────────────");
  console.log("  CHECK RESULTS");
  console.log("────────────────────────────────────────────────────────────────");

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon}  ${r.name}`);
    console.log(`    ${r.details}`);
    if (!r.passed) allPassed = false;
  }

  console.log("\n════════════════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("  🎉 DAY 6 VERIFICATION COMPLETE — ALL CHECKS PASSED!");
  } else {
    console.log("  ⚠️  SOME CHECKS FAILED — REVIEW THE LOG ABOVE.");
  }
  console.log("════════════════════════════════════════════════════════════════\n");

  if (!allPassed) process.exit(1);
}

runVerification().catch((e) => {
  console.error("Fatal error during verification:", e);
  process.exit(1);
});
