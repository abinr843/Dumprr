import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLogPayload } from "@/types/audit";
import { logAction } from "./log-action";

/**
 * Records an audit trail event to the audit_logs table.
 * Delegates to logAction() for unified formatting and secret redaction.
 */
export async function logAuditEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _supabase: SupabaseClient<any>,
  userId: string | null,
  payload: AuditLogPayload,
  context?: {
    ipAddress?: string;
    userAgent?: string;
  }
) {
  await logAction({
    actor_user_id: userId,
    action: payload.action,
    target_type: payload.entityType,
    target_id: payload.entityId ?? undefined,
    result: "SUCCESS",
    ip_address: context?.ipAddress ?? null,
    user_agent: context?.userAgent ?? null,
    metadata: payload.metadata ?? {},
  });
}
