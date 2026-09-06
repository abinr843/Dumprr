import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedClient = SupabaseClient<Database>;

/**
 * Storage helper functions wrapping Supabase Storage operations.
 */

/** Upload a file to a storage bucket */
export async function uploadFile(
  supabase: TypedClient,
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { upsert?: boolean; contentType?: string }
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: options?.upsert ?? false,
      contentType: options?.contentType,
    });

  if (error) throw error;
  return data;
}

/** Download a file from a storage bucket */
export async function downloadFile(
  supabase: TypedClient,
  bucket: string,
  path: string
) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

/** Delete a file from a storage bucket */
export async function deleteFile(
  supabase: TypedClient,
  bucket: string,
  paths: string[]
) {
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
  return data;
}

/** Get a public URL for a file (only works for public buckets) */
export function getPublicUrl(
  supabase: TypedClient,
  bucket: string,
  path: string
) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Generate a signed/temporary URL for a private file */
export async function getSignedUrl(
  supabase: TypedClient,
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
