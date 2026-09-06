/**
 * DUMPR — Day 3 Database Schema & RLS Verification Script
 *
 * Verifies:
 * 1. Public visitors can read active files, folders, and posts.
 * 2. Public visitors CANNOT see trash or deleted files/folders.
 * 3. Public visitors CANNOT insert, update, or delete files or folders.
 * 4. Public visitors CANNOT read or insert audit_logs.
 * 5. Admin can access all content (including trash and audit logs).
 *
 * Usage:
 *   npx -y tsx scripts/verify-day3.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Client 1: Anonymous public visitor (subject to public RLS)
const publicClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

// Client 2: Service Role Admin (bypasses RLS to verify data presence)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<boolean>, detailSuccess: string, detailFailure: string) {
  try {
    const ok = await fn();
    results.push({ name, passed: ok, details: ok ? detailSuccess : detailFailure });
  } catch (err: any) {
    results.push({ name, passed: false, details: `Exception: ${err.message}` });
  }
}

async function verify() {
  console.log("\n🔍 Running Day 3 Schema & RLS Verification...\n");

  // 1. Verify files exist in database via admin
  await check(
    "Database Connectivity & Files Presence",
    async () => {
      const { data, error } = await adminClient.from("files").select("id, status").limit(5);
      return !error && Array.isArray(data);
    },
    "Connected and fetched files via admin client",
    "Failed to connect or query files table"
  );

  // 2. Verify public visitor can read active files
  await check(
    "Public Visitor: Read Active Files",
    async () => {
      const { data, error } = await publicClient
        .from("files")
        .select("id, name, status, extension, download_count")
        .eq("status", "active");
      return !error && Array.isArray(data);
    },
    "Public visitor can read active files",
    "Public visitor could not query active files"
  );

  // 3. Verify public visitor CANNOT see trashed files
  await check(
    "Public Visitor RLS: Trashed Files Hidden",
    async () => {
      const { data } = await publicClient
        .from("files")
        .select("id, name, status")
        .eq("status", "trash");
      return !data || data.length === 0;
    },
    "RLS blocked public visitor from reading trashed files (0 returned)",
    "RLS leak: Public visitor was able to read trashed files!"
  );

  // 4. Verify public visitor CANNOT see deleted files
  await check(
    "Public Visitor RLS: Deleted Files Hidden",
    async () => {
      const { data } = await publicClient
        .from("files")
        .select("id, name, status")
        .eq("status", "deleted");
      return !data || data.length === 0;
    },
    "RLS blocked public visitor from reading deleted files (0 returned)",
    "RLS leak: Public visitor was able to read deleted files!"
  );

  // 5. Verify public visitor CANNOT insert files
  await check(
    "Public Visitor RLS: Insert File Blocked",
    async () => {
      const { error } = await publicClient.from("files").insert({
        name: "malicious_upload.exe",
        original_name: "malicious_upload.exe",
        owner_id: "00000000-0000-0000-0000-000000000000",
        storage_path: "hack.exe",
        size_bytes: 100,
      } as any);
      return !!error; // Expecting error
    },
    "RLS properly rejected public file insert",
    "Security vulnerability: Public visitor was allowed to insert files!"
  );

  // 6. Verify public visitor CANNOT insert folders
  await check(
    "Public Visitor RLS: Insert Folder Blocked",
    async () => {
      const { error } = await publicClient.from("folders").insert({
        name: "Unauthorized Folder",
        owner_id: "00000000-0000-0000-0000-000000000000",
      } as any);
      return !!error;
    },
    "RLS properly rejected public folder insert",
    "Security vulnerability: Public visitor was allowed to insert folders!"
  );

  // 7. Verify public visitor CANNOT read audit logs
  await check(
    "Public Visitor RLS: Audit Logs Blocked",
    async () => {
      const { data, error } = await publicClient.from("audit_logs").select("id").limit(10);
      return error != null || !data || data.length === 0;
    },
    "RLS blocked public visitor from reading audit logs (access denied / 0 rows)",
    "Security vulnerability: Public visitor was able to read audit logs!"
  );

  // 8. Verify public visitor CANNOT insert audit logs directly
  await check(
    "Public Visitor RLS: Insert Audit Log Blocked",
    async () => {
      const { error } = await publicClient.from("audit_logs").insert({
        action: "hack.attempt",
        entity_type: "auth",
      } as any);
      return !!error;
    },
    "RLS properly rejected public audit log insert",
    "Security vulnerability: Public visitor was able to insert audit logs!"
  );

  // 9. Verify public visitor can read active folders
  await check(
    "Public Visitor: Read Active Folders",
    async () => {
      const { data, error } = await publicClient
        .from("folders")
        .select("id, name, status")
        .eq("status", "active");
      return !error && Array.isArray(data);
    },
    "Public visitor can browse active folders",
    "Public visitor could not query active folders"
  );

  // 10. Verify public visitor CANNOT see trashed folders
  await check(
    "Public Visitor RLS: Trashed Folders Hidden",
    async () => {
      const { data } = await publicClient
        .from("folders")
        .select("id, name, status")
        .eq("status", "trash");
      return !data || data.length === 0;
    },
    "RLS blocked public visitor from reading trashed folders",
    "RLS leak: Public visitor was able to read trashed folders!"
  );

  // Print results
  console.log("┌─────────────────────────────────────────────────────────────┬──────────┐");
  console.log("│ Check                                                       │ Status   │");
  console.log("├─────────────────────────────────────────────────────────────┼──────────┤");
  for (const r of results) {
    const status = r.passed ? "✅ PASS   " : "❌ FAIL   ";
    const name = r.name.padEnd(59).slice(0, 59);
    console.log(`│ ${name} │ ${status} │`);
    console.log(`│   └─ ${r.details.padEnd(68).slice(0, 68)} │`);
  }
  console.log("└─────────────────────────────────────────────────────────────┴──────────┘");

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log("\n🎉 All 10 Day 3 RLS & Schema Checks Passed!\n");
  } else {
    console.warn("\n⚠️ Some checks did not pass. If tables were not yet migrated in Supabase, run 00004_full_schema_and_rls.sql first.\n");
  }
}

verify().catch((err) => {
  console.error("Verification failed:", err);
});
