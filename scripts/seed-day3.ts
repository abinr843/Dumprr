/**
 * DUMPR — Day 3 Database Seed Script
 *
 * Populates sample folders, files across multiple extensions,
 * posts, and system settings for the single-admin file sharing platform.
 *
 * Usage:
 *   npm run seed:day3
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || "Admin123456!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("\n🚀 Seeding DUMPR Day 3 Data...");
  console.log(`   Target Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Admin Email:         ${ADMIN_EMAIL}\n`);

  // 1. Ensure Admin exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (listError) {
    console.error("❌ Failed to list users:", listError.message);
    process.exit(1);
  }

  let adminUser = usersData.users.find((u) => u.email === ADMIN_EMAIL);
  if (!adminUser) {
    console.log("Creating admin account...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: "admin",
        full_name: "DUMPR Administrator",
        role: "superadmin",
      },
    });

    if (createError || !newUser.user) {
      console.error("❌ Failed to create admin:", createError?.message);
      process.exit(1);
    }
    adminUser = newUser.user;
    console.log(`✅ Created admin user: ${adminUser.id}`);
  } else {
    console.log(`ℹ️  Admin user found: ${adminUser.id}`);
  }

  // Ensure admin profile has superadmin role
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: adminUser.id,
      username: "admin",
      full_name: "DUMPR Administrator",
      role: "superadmin",
      avatar_url: "",
      storage_quota_bytes: 10737418240, // 10 GB
      storage_used_bytes: 93816776,
    });

  if (profileError) {
    console.warn("⚠️  Profile upsert warning:", profileError.message);
  } else {
    console.log("✅ Admin profile verified as superadmin");
  }

  // 2. Folders
  const folders = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Documents",
      parent_id: null,
      owner_id: adminUser.id,
      path: "/Documents",
      color: "#6366f1",
      is_favorite: true,
      status: "active",
      deleted_at: null,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Legal & Contracts",
      parent_id: "11111111-1111-1111-1111-111111111111",
      owner_id: adminUser.id,
      path: "/Documents/Legal & Contracts",
      color: "#6366f1",
      is_favorite: false,
      status: "active",
      deleted_at: null,
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Media & Assets",
      parent_id: null,
      owner_id: adminUser.id,
      path: "/Media & Assets",
      color: "#ec4899",
      is_favorite: true,
      status: "active",
      deleted_at: null,
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Software & Tools",
      parent_id: null,
      owner_id: adminUser.id,
      path: "/Software & Tools",
      color: "#10b981",
      is_favorite: false,
      status: "active",
      deleted_at: null,
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      name: "Archived Reports 2025",
      parent_id: "11111111-1111-1111-1111-111111111111",
      owner_id: adminUser.id,
      path: "/Documents/Archived Reports 2025",
      color: "#94a3b8",
      is_favorite: false,
      status: "trash",
      deleted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "66666666-6666-6666-6666-666666666666",
      name: "Old Backups",
      parent_id: null,
      owner_id: adminUser.id,
      path: "/Old Backups",
      color: "#64748b",
      is_favorite: false,
      status: "deleted",
      deleted_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];

  const { error: foldersError } = await supabase.from("folders").upsert(folders);
  if (foldersError) {
    console.warn("⚠️  Folders seed warning:", foldersError.message);
  } else {
    console.log(`✅ Seeded ${folders.length} folders (active, trash, deleted)`);
  }

  // 3. Files across multiple extensions
  const files = [
    {
      id: "a0000001-0000-0000-0000-000000000001",
      folder_id: "11111111-1111-1111-1111-111111111111",
      owner_id: adminUser.id,
      name: "Platform_Overview.pdf",
      original_name: "Platform_Overview.pdf",
      mime_type: "application/pdf",
      extension: "pdf",
      size_bytes: 2450000,
      storage_bucket: "files",
      storage_path: "docs/Platform_Overview.pdf",
      is_public: true,
      download_count: 42,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000002-0000-0000-0000-000000000002",
      folder_id: "22222222-2222-2222-2222-222222222222",
      owner_id: adminUser.id,
      name: "Master_Service_Agreement_v3.pdf",
      original_name: "Master_Service_Agreement_v3.pdf",
      mime_type: "application/pdf",
      extension: "pdf",
      size_bytes: 1200000,
      storage_bucket: "files",
      storage_path: "docs/Master_Service_Agreement_v3.pdf",
      is_public: true,
      download_count: 18,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000003-0000-0000-0000-000000000003",
      folder_id: "11111111-1111-1111-1111-111111111111",
      owner_id: adminUser.id,
      name: "financial_projection_2026.csv",
      original_name: "financial_projection_2026.csv",
      mime_type: "text/csv",
      extension: "csv",
      size_bytes: 85000,
      storage_bucket: "files",
      storage_path: "docs/financial_projection_2026.csv",
      is_public: true,
      download_count: 19,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000004-0000-0000-0000-000000000004",
      folder_id: "33333333-3333-3333-3333-333333333333",
      owner_id: adminUser.id,
      name: "brand_logo_master.png",
      original_name: "brand_logo_master.png",
      mime_type: "image/png",
      extension: "png",
      size_bytes: 1048576,
      storage_bucket: "files",
      storage_path: "media/brand_logo_master.png",
      is_public: true,
      download_count: 128,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000005-0000-0000-0000-000000000005",
      folder_id: "33333333-3333-3333-3333-333333333333",
      owner_id: adminUser.id,
      name: "intro_walkthrough.mp4",
      original_name: "intro_walkthrough.mp4",
      mime_type: "video/mp4",
      extension: "mp4",
      size_bytes: 25000000,
      storage_bucket: "files",
      storage_path: "media/intro_walkthrough.mp4",
      is_public: true,
      download_count: 75,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000006-0000-0000-0000-000000000006",
      folder_id: "44444444-4444-4444-4444-444444444444",
      owner_id: adminUser.id,
      name: "dumpr_toolkit.zip",
      original_name: "dumpr_toolkit.zip",
      mime_type: "application/zip",
      extension: "zip",
      size_bytes: 12500000,
      storage_bucket: "files",
      storage_path: "tools/dumpr_toolkit.zip",
      is_public: true,
      download_count: 201,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000007-0000-0000-0000-000000000007",
      folder_id: "44444444-4444-4444-4444-444444444444",
      owner_id: adminUser.id,
      name: "system_firmware_v2.iso",
      original_name: "system_firmware_v2.iso",
      mime_type: "application/x-iso9660-image",
      extension: "iso",
      size_bytes: 45000000,
      storage_bucket: "files",
      storage_path: "tools/system_firmware_v2.iso",
      is_public: true,
      download_count: 310,
      status: "active",
      deleted_at: null,
    },
    {
      id: "a0000008-0000-0000-0000-000000000008",
      folder_id: "44444444-4444-4444-4444-444444444444",
      owner_id: adminUser.id,
      name: "api_specification.json",
      original_name: "api_specification.json",
      mime_type: "application/json",
      extension: "json",
      size_bytes: 32000,
      storage_bucket: "files",
      storage_path: "tools/api_specification.json",
      is_public: true,
      download_count: 54,
      status: "active",
      deleted_at: null,
    },
    // Trashed files
    {
      id: "a0000009-0000-0000-0000-000000000009",
      folder_id: "11111111-1111-1111-1111-111111111111",
      owner_id: adminUser.id,
      name: "outdated_contract_draft.docx",
      original_name: "outdated_contract_draft.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
      size_bytes: 520000,
      storage_bucket: "files",
      storage_path: "trash/outdated_contract_draft.docx",
      is_public: false,
      download_count: 3,
      status: "trash",
      deleted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: "a0000010-0000-0000-0000-000000000010",
      folder_id: "33333333-3333-3333-3333-333333333333",
      owner_id: adminUser.id,
      name: "corrupted_recording.mp4",
      original_name: "corrupted_recording.mp4",
      mime_type: "video/mp4",
      extension: "mp4",
      size_bytes: 15000000,
      storage_bucket: "files",
      storage_path: "trash/corrupted_recording.mp4",
      is_public: false,
      download_count: 0,
      status: "trash",
      deleted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    // Deleted file
    {
      id: "a0000011-0000-0000-0000-000000000011",
      folder_id: "66666666-6666-6666-6666-666666666666",
      owner_id: adminUser.id,
      name: "deprecated_api_key_dump.txt",
      original_name: "deprecated_api_key_dump.txt",
      mime_type: "text/plain",
      extension: "txt",
      size_bytes: 1200,
      storage_bucket: "files",
      storage_path: "deleted/deprecated_api_key_dump.txt",
      is_public: false,
      download_count: 0,
      status: "deleted",
      deleted_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
  ];

  const { error: filesError } = await supabase.from("files").upsert(files);
  if (filesError) {
    console.warn("⚠️  Files seed warning:", filesError.message);
  } else {
    console.log(`✅ Seeded ${files.length} files (.pdf, .png, .mp4, .zip, .csv, .iso, .docx, .txt)`);
  }

  // 4. Posts
  const posts = [
    {
      id: "b0000001-0000-0000-0000-000000000001",
      author_id: adminUser.id,
      title: "Welcome to DUMPR",
      slug: "welcome-to-dumpr",
      content: "# Welcome to DUMPR\n\nYour centralized platform for accessing curated file archives, media toolkits, and software bundles.",
      excerpt: "Platform introduction and guide for visitors.",
      status: "published",
      featured_image_url: "",
      tags: ["announcement", "guide"],
      published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      deleted_at: null,
    },
    {
      id: "b0000002-0000-0000-0000-000000000002",
      author_id: adminUser.id,
      title: "September 2026 File Catalog Released",
      slug: "september-2026-file-catalog-released",
      content: "# September 2026 Catalog\n\nAll tools, documents, and firmware bundles have been updated to latest versions.",
      excerpt: "Overview of latest files and toolkits.",
      status: "published",
      featured_image_url: "",
      tags: ["updates", "downloads"],
      published_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      deleted_at: null,
    },
    {
      id: "b0000003-0000-0000-0000-000000000003",
      author_id: adminUser.id,
      title: "Upcoming Network Firmware v3",
      slug: "upcoming-network-firmware-v3",
      content: "# Draft Notes\n\nUpcoming changes in firmware v3.",
      excerpt: "Draft notes on upcoming firmware.",
      status: "draft",
      featured_image_url: "",
      tags: ["firmware", "draft"],
      published_at: null,
      deleted_at: null,
    },
    {
      id: "b0000004-0000-0000-0000-000000000004",
      author_id: adminUser.id,
      title: "Old Legacy Service Discontinuation",
      slug: "old-legacy-service-discontinuation",
      content: "# Deprecated notice",
      excerpt: "Old announcement now in trash.",
      status: "archived",
      featured_image_url: "",
      tags: ["archived"],
      published_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      deleted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  const { error: postsError } = await supabase.from("posts").upsert(posts);
  if (postsError) {
    console.warn("⚠️  Posts seed warning:", postsError.message);
  } else {
    console.log(`✅ Seeded ${posts.length} posts (published, draft, trash)`);
  }

  // 5. System Settings
  const settings = [
    { key: "platform_name", value: "DUMPR", description: "Application title", is_public: true, updated_by: adminUser.id },
    { key: "max_upload_size_mb", value: 100, description: "Maximum file size allowed in megabytes", is_public: true, updated_by: adminUser.id },
    { key: "allow_public_downloads", value: true, description: "Whether public visitors can download files", is_public: true, updated_by: adminUser.id },
    { key: "admin_contact", value: "abinrphilip34@gmail.com", description: "Public administrator contact email", is_public: true, updated_by: adminUser.id },
  ];

  const { error: settingsError } = await supabase.from("system_settings").upsert(settings);
  if (settingsError) {
    console.warn("⚠️  Settings seed warning:", settingsError.message);
  } else {
    console.log(`✅ Seeded ${settings.length} system settings`);
  }

  console.log("\n✨ Day 3 Seeding Completed Successfully!");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
