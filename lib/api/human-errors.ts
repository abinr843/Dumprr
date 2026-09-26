import type { SecurityRejectionReason } from "@/lib/storage/file-validation";

/**
 * Phase 3: human (actionable, non-technical) message mapping.
 * Pure functions — safe to unit test, usable on server and client.
 */

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Friendly message for an upload security/validation rejection reason. */
export function humanizeUploadRejection(
  reason: SecurityRejectionReason | undefined,
  opts?: { extension?: string | null; maxBytes?: number; allowed?: string[] | "*" }
): string {
  const ext = (opts?.extension || "").replace(/^\./, "");
  switch (reason) {
    case "SIZE_LIMIT_EXCEEDED":
      return `This file is too large. Please upload a file smaller than ${formatMb(
        opts?.maxBytes ?? 70 * 1024 * 1024
      )}.`;
    case "DISALLOWED_EXTENSION":
      if (ext === "exe" || ext === "msi" || ext === "bat" || ext === "cmd" || ext === "com" || ext === "scr") {
        return `Executable files (.${ext}) aren't allowed for security reasons. Please upload a document, image, or archive instead.`;
      }
      if (opts?.allowed && opts.allowed !== "*" && opts.allowed.length > 0) {
        return `Files of type .${ext || "unknown"} aren't allowed. Please use one of: ${opts.allowed
          .slice(0, 12)
          .map((e) => `.${e}`)
          .join(", ")}.`;
      }
      return `Files of type .${ext || "unknown"} aren't allowed. Please choose a supported format.`;
    case "DISGUISED_EXECUTABLE":
      return "This file was blocked for security reasons — it looks like an executable program disguised as a document.";
    case "MAGIC_BYTES_MISMATCH":
      return `This file appears to be damaged or isn't really a .${ext || "file"} file. Please check the file and try again.`;
    case "INVALID_TEXT_ENCODING":
      return "This text file contains binary data and couldn't be verified. Please upload a plain-text file.";
    case "MALFORMED_FILENAME":
      return "This filename contains characters we can't store safely. Please rename the file and try again.";
    case "EMPTY_FILE":
      return "This file is empty (0 bytes). Please choose a file with content.";
    default:
      return "We couldn't accept this file. Please check the format and try again.";
  }
}

/**
 * Convert a raw technical error (DB dumps, driver messages, stack traces)
 * into a plain user-facing message. Never returns schema/constraint internals.
 */
export function humanizeTechnicalError(
  raw: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");

  // PostgREST: no rows returned → not found
  if (/PGRST116|Results contain 0 rows|Row not found/i.test(msg)) {
    return "We couldn't find what you were looking for. It may have been moved or deleted.";
  }
  // PostgREST: schema cache / missing table (migration not run)
  if (/schema cache|PGRST20[0-9]|Could not find the table/i.test(msg)) {
    return "The database isn't set up for this yet. Please ask an admin to run the latest migration.";
  }
  // Postgres not-null constraint → name the field in plain words
  const notNull = msg.match(/null value in column "([^"]+)"/i);
  if (notNull) {
    const field = notNull[1].replace(/_/g, " ");
    return `Please provide ${/^[aeiou]/i.test(field) ? "an" : "a"} ${field} before saving.`;
  }
  // Postgres unique violation → already exists
  if (/duplicate key|unique constraint|already exists/i.test(msg)) {
    const col = msg.match(/Key \(([^)]+)\)/);
    if (col) {
      return `That ${col[1].replace(/_/g, " ")} is already in use. Please choose another.`;
    }
    return "This already exists. Please change the name and try again.";
  }
  // Foreign key violation → related item missing
  if (/foreign key|violates foreign/i.test(msg)) {
    return "The linked item no longer exists. Please refresh and try again.";
  }
  // Invalid UUID / bad identifier
  if (/invalid (input syntax|UUID|uuid)/i.test(msg)) {
    return "That link looks invalid. Please refresh and try again.";
  }
  // Network / fetch failures
  if (/Failed to fetch|NetworkError|network error|Load failed|ECONNREFUSED|ENOTFOUND|timed out/i.test(msg)) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  // Invalid JSON
  if (/invalid json|Unexpected token .* in JSON/i.test(msg)) {
    return "We couldn't process that request. Please refresh and try again.";
  }
  // JWT / session
  if (/jwt|token|session|expired/i.test(msg) && /auth|session|sign/i.test(msg)) {
    return "Your session has expired. Please sign in again.";
  }
  // RLS / permission denied from the database layer
  if (/permission denied|row-level security|RLS|not authorized/i.test(msg)) {
    return "You don't have permission to do that.";
  }
  // Storage bucket errors
  if (/bucket|Bucket not found/i.test(msg)) {
    return "File storage isn't available right now. Please try again later.";
  }
  if (/storage limit|quota|cap/i.test(msg) && /exceed/i.test(msg)) {
    return msg.length < 160 ? msg : "Storage is full. Please delete files or ask an admin to raise the limit.";
  }
  // Payload too large
  if (/too large|payload|413|limit/i.test(msg) && /size|large|limit|byte/i.test(msg)) {
    return "That file is too large. Please try a smaller file.";
  }

  // If the raw message is already short, plain, and leak-free, reuse it.
  const trimmed = msg.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 160 &&
    !/column "|constraint|PGRST|SELECT|INSERT INTO|UPDATE |DELETE FROM|at |Error:|stack|node_modules|pg-|supabase/i.test(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}

/** Summarize Zod field errors into one actionable sentence. */
export function humanizeZodDetails(details: unknown): string {
  try {
    const d = details as {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
    const fields = d?.fieldErrors ? Object.keys(d.fieldErrors) : [];
    if (fields.length > 0) {
      const names = fields.map((f) => f.replace(/_/g, " ")).join(", ");
      return `Please check the highlighted fields (${names}) and try again.`;
    }
    if (d?.formErrors?.length) return d.formErrors[0];
  } catch {
    /* fall through */
  }
  return "Please check your input and try again.";
}
