import { AUDIT_ACTIONS, type AuditAction } from "@/types/audit";
import { logAction } from "./log-action";

/**
 * Auth-specific audit event logger.
 *
 * Uses logAction() to record authentication events with
 * unified schema, recursive secret redaction, and RLS bypass.
 */

interface AuthAuditOptions {
  action: AuditAction;
  userId?: string | null;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an authentication-related event to the audit_logs table.
 * Safe to call for both authenticated and unauthenticated events.
 */
export async function logAuthEvent({
  action,
  userId,
  email,
  ipAddress,
  userAgent,
  metadata = {},
}: AuthAuditOptions): Promise<void> {
  const isFailure =
    action === AUDIT_ACTIONS.LOGIN_FAILED ||
    action === AUDIT_ACTIONS.PERMISSION_DENIED ||
    action === AUDIT_ACTIONS.UNAUTHORIZED_REQUEST;

  await logAction({
    actor_user_id: userId ?? null,
    action,
    target_type: "auth",
    target_id: userId ?? email ?? null,
    target_name: email ?? userId ?? undefined,
    result: isFailure ? "FAILED" : "SUCCESS",
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    metadata: {
      email,
      ...metadata,
    },
  });
}

/** Convenience: log a successful login */
export function logLoginSuccess(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    userId,
    email,
    ipAddress,
    userAgent,
  });
}

/** Convenience: log a failed login attempt */
export function logLoginFailed(
  email: string,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.LOGIN_FAILED,
    email,
    ipAddress,
    userAgent,
    metadata: { reason },
  });
}

/** Convenience: log a logout */
export function logLogout(
  userId: string,
  email?: string,
  ipAddress?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.LOGOUT,
    userId,
    email,
    ipAddress,
  });
}

/** Convenience: log session creation */
export function logSessionCreated(
  userId: string,
  email?: string,
  ipAddress?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.SESSION_CREATED,
    userId,
    email,
    ipAddress,
  });
}

/** Convenience: log session revocation */
export function logSessionRevoked(
  userId: string,
  email?: string,
  ipAddress?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.SESSION_REVOKED,
    userId,
    email,
    ipAddress,
  });
}

/** Convenience: log password change */
export function logPasswordChanged(
  userId: string,
  email?: string,
  ipAddress?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    userId,
    email,
    ipAddress,
  });
}

/** Convenience: log password reset request */
export function logPasswordResetRequested(
  email: string,
  ipAddress?: string
) {
  return logAuthEvent({
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    email,
    ipAddress,
  });
}
