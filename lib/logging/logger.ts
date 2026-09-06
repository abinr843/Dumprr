/**
 * Structured logger for DUMPR.
 *
 * Provides levelled logging with consistent formatting.
 * In production, this can be swapped for a structured logging service
 * (e.g., Axiom, Datadog, Sentry) without changing call sites.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

function createEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
}

function emit(entry: LogEntry) {
  const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;

  switch (entry.level) {
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(prefix, entry.message, entry.data ?? "");
      }
      break;
    case "info":
      console.info(prefix, entry.message, entry.data ?? "");
      break;
    case "warn":
      console.warn(prefix, entry.message, entry.data ?? "");
      break;
    case "error":
      console.error(prefix, entry.message, entry.data ?? "");
      break;
  }
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    emit(createEntry("debug", message, data));
  },
  info(message: string, data?: Record<string, unknown>) {
    emit(createEntry("info", message, data));
  },
  warn(message: string, data?: Record<string, unknown>) {
    emit(createEntry("warn", message, data));
  },
  error(message: string, data?: Record<string, unknown>) {
    emit(createEntry("error", message, data));
  },
};
