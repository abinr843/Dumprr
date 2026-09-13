/**
 * Environment configuration and validation for the DUMPR Express backend.
 *
 * Validates all required environment variables at startup and provides
 * typed access to configuration values.
 */

import dotenv from "dotenv";
import path from "path";

// Load .env.local (Next.js convention) — tsx/Node doesn't auto-load this
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
// Fallback to .env if .env.local doesn't exist
dotenv.config({ path: path.resolve(process.cwd(), ".env") });


interface EnvConfig {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_DEFAULT_EMAIL: string;
  CRON_SECRET: string | undefined;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

let _config: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (_config) return _config;

  _config = {
    PORT: parseInt(process.env.PORT || "5000", 10),
    NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
    NEXT_PUBLIC_SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ADMIN_DEFAULT_EMAIL: (
      process.env.ADMIN_DEFAULT_EMAIL || "abinrphilip34@gmail.com"
    ).toLowerCase(),
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  };

  return _config;
}

/**
 * Validate environment at startup. Throws if any required vars are missing.
 */
export function validateEnv(): void {
  getEnvConfig();
  console.log("[ENV] Environment validation passed");
}
