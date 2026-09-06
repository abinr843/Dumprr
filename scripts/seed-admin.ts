/**
 * DUMPR — Admin Account Seeder
 *
 * Creates or resets the root administrator account using the
 * Supabase Admin API (auth.admin.createUser / auth.admin.updateUserById).
 *
 * Usage:
 *   npm run seed:admin
 *
 * Environment variables (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_DEFAULT_EMAIL    (default: abinrphilip34@gmail.com)
 *   ADMIN_DEFAULT_PASSWORD (default: Admin123456!)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL =
  process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || "Admin123456!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedAdmin() {
  console.log(`\n🔑 DUMPR Admin Seeder`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   URL:   ${SUPABASE_URL}\n`);

  // Check if user already exists by listing users and filtering by email
  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    console.error("❌ Failed to list users:", listError.message);
    process.exit(1);
  }

  const existingAdmin = existingUsers?.users?.find(
    (u) => u.email === ADMIN_EMAIL
  );

  if (existingAdmin) {
    // Ensure the profile row exists and has superadmin role
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: existingAdmin.id,
        username: "admin",
        full_name: "DUMPR Administrator",
        role: "superadmin",
      });

    if (upsertError) {
      console.error("❌ Failed to upsert profile:", upsertError.message);
      process.exit(1);
    }

    console.log("✅ Admin profile upserted with superadmin role.\n");
    return;
  }

  // Create new admin user
  const { data: newUser, error: createError } =
    await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Skip email verification
      user_metadata: {
        username: "admin",
        full_name: "DUMPR Administrator",
        role: "superadmin",
      },
    });

  if (createError) {
    console.error("❌ Failed to create admin user:", createError.message);
    process.exit(1);
  }

  console.log(`✅ Admin user created: ${newUser.user.id}`);

  // The handle_new_user trigger will create the profile with 'superadmin' role
  // via user_metadata.role, but we ensure it directly too:
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "superadmin" })
    .eq("id", newUser.user.id);

  if (profileError) {
    console.warn(
      "⚠️  Could not force superadmin role (trigger may have set it):",
      profileError.message
    );
  }

  console.log(`✅ Admin account ready.`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     superadmin\n`);
}

seedAdmin().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
