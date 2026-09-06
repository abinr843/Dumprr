import type { AuditAction, AuditEntityType } from "@/types/audit";
import { logAction } from "./log-action";

export interface PostAuditOptions {
  action: AuditAction;
  entityType?: AuditEntityType;
  userId?: string | null;
  postId?: string | null;
  postTitle?: string;
  slug?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a post lifecycle event to public.audit_logs using logAction().
 */
export async function logPostEvent({
  action,
  entityType = "post",
  userId = null,
  postId = null,
  postTitle,
  slug,
  ipAddress,
  userAgent,
  metadata = {},
}: PostAuditOptions): Promise<void> {
  await logAction({
    actor_user_id: userId,
    action,
    target_type: entityType,
    target_id: postId ?? undefined,
    target_name: postTitle ?? slug ?? undefined,
    result: "SUCCESS",
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    metadata: {
      postTitle,
      slug,
      ...metadata,
    },
  });
}
