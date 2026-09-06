import { AUDIT_ACTIONS, type AuditAction, type AuditEntityType } from "@/types/audit";
import { logAction } from "./log-action";

export interface FileAuditOptions {
  action: AuditAction;
  entityType?: AuditEntityType;
  userId?: string | null;
  fileId?: string | null;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  storagePath?: string;
  ipAddress?: string;
  userAgent?: string;
  error?: string;
  securityReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a file upload lifecycle or security event to public.audit_logs
 * using logAction() to ensure reliable capture and redaction.
 */
export async function logFileEvent({
  action,
  entityType = "file",
  userId = null,
  fileId = null,
  fileName,
  sizeBytes,
  mimeType,
  storagePath,
  ipAddress,
  userAgent,
  error,
  securityReason,
  metadata = {},
}: FileAuditOptions): Promise<void> {
  const isFailure =
    Boolean(error) ||
    Boolean(securityReason) ||
    action === AUDIT_ACTIONS.FILE_UPLOAD_FAILED ||
    action === AUDIT_ACTIONS.FILE_UPLOAD_REJECTED ||
    action === AUDIT_ACTIONS.SECURITY_UPLOAD_REJECTED ||
    action === AUDIT_ACTIONS.SECURITY_INVALID_FILE ||
    action === AUDIT_ACTIONS.PERMISSION_DENIED ||
    action === AUDIT_ACTIONS.UNAUTHORIZED_REQUEST ||
    action === AUDIT_ACTIONS.DOWNLOAD_REJECTED;

  await logAction({
    actor_user_id: userId,
    action,
    target_type: entityType,
    target_id: fileId ?? undefined,
    target_name: fileName ?? undefined,
    result: isFailure ? "FAILED" : "SUCCESS",
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    metadata: {
      fileName,
      sizeBytes,
      mimeType,
      storagePath,
      error,
      securityReason,
      ...metadata,
    },
  });
}

/**
 * Helper to log when a file upload starts
 */
export async function logFileUploadStarted(options: Omit<FileAuditOptions, "action">) {
  return logFileEvent({ ...options, action: AUDIT_ACTIONS.FILE_UPLOAD_STARTED });
}

/**
 * Helper to log when a file upload successfully completes
 */
export async function logFileUploadCompleted(options: Omit<FileAuditOptions, "action">) {
  return logFileEvent({ ...options, action: AUDIT_ACTIONS.FILE_UPLOAD_COMPLETED });
}

/**
 * Helper to log an internal storage or database upload failure
 */
export async function logFileUploadFailed(options: Omit<FileAuditOptions, "action">) {
  return logFileEvent({ ...options, action: AUDIT_ACTIONS.FILE_UPLOAD_FAILED });
}

/**
 * Helper to log an upload rejection due to standard validation
 */
export async function logFileUploadRejected(options: Omit<FileAuditOptions, "action">) {
  return logFileEvent({ ...options, action: AUDIT_ACTIONS.FILE_UPLOAD_REJECTED });
}

/**
 * Helper to log a security-flagged upload rejection (e.g. disguised executable)
 */
export async function logSecurityUploadRejected(options: Omit<FileAuditOptions, "action" | "entityType">) {
  return logFileEvent({
    ...options,
    action: AUDIT_ACTIONS.SECURITY_UPLOAD_REJECTED,
    entityType: "security",
  });
}

/**
 * Helper to log an invalid/corrupt file security event
 */
export async function logSecurityInvalidFile(options: Omit<FileAuditOptions, "action" | "entityType">) {
  return logFileEvent({
    ...options,
    action: AUDIT_ACTIONS.SECURITY_INVALID_FILE,
    entityType: "security",
  });
}
