import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import type { FolderWithStats } from "@/types/storage";

type FileRow = Database["public"]["Tables"]["files"]["Row"];

/**
 * Server-side fetch for root-level files (folder_id IS NULL).
 * Used by the RSC page to hydrate FilesManager without client-side fetch.
 */
export async function getRootFiles(isAdmin: boolean): Promise<FileRow[]> {
  const admin = createAdminClient();

  let query = admin
    .from("files")
    .select("*")
    .is("folder_id", null);

  if (!isAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  } else {
    query = query.eq("status", "active");
  }

  query = query.order("created_at", { ascending: false }).limit(100);

  const { data, error } = await query;
  if (error) {
    console.error("[getRootFiles] Error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Server-side fetch for root-level folders (parent_id IS NULL)
 * with batch-enriched child counts.
 */
export async function getRootFolders(isAdmin: boolean): Promise<FolderWithStats[]> {
  const admin = createAdminClient();

  let query = admin.from("folders").select("*").is("parent_id", null);

  if (!isAdmin) {
    query = query.eq("status", "active").is("deleted_at", null);
  } else {
    query = query.eq("status", "active");
  }

  query = query.order("name", { ascending: true });

  const { data: folders, error } = await query;
  if (error) {
    console.error("[getRootFolders] Error:", error.message);
    return [];
  }

  if (!folders || folders.length === 0) return [];

  // Batch-enrich with child counts
  const folderIds = folders.map((f) => f.id);

  const [childFoldersResult, childFilesResult] = await Promise.all([
    admin
      .from("folders")
      .select("parent_id")
      .in("parent_id", folderIds)
      .eq("status", "active"),
    admin
      .from("files")
      .select("folder_id")
      .in("folder_id", folderIds)
      .eq("status", "active"),
  ]);

  const childFolderCounts: Record<string, number> = {};
  const childFileCounts: Record<string, number> = {};

  if (childFoldersResult.data) {
    for (const row of childFoldersResult.data) {
      if (row.parent_id) {
        childFolderCounts[row.parent_id] = (childFolderCounts[row.parent_id] || 0) + 1;
      }
    }
  }

  if (childFilesResult.data) {
    for (const row of childFilesResult.data) {
      if (row.folder_id) {
        childFileCounts[row.folder_id] = (childFileCounts[row.folder_id] || 0) + 1;
      }
    }
  }

  return folders.map((folder) => ({
    ...folder,
    childFolderCount: childFolderCounts[folder.id] || 0,
    childFileCount: childFileCounts[folder.id] || 0,
  }));
}
