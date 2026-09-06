/**
 * Tests for centralized audit logging and recursive secret redaction (Day 7).
 */

import { redactSensitiveData, logAction } from "@/lib/logging/log-action";
import { AUDIT_ACTIONS } from "@/types/audit";
import { createAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

describe("redactSensitiveData", () => {
  it("redacts sensitive keys such as password, token, secret, authorization", () => {
    const input = {
      user_email: "user@example.com",
      password: "SuperSecretPassword123!",
      api_token: "xyz987654321",
      authorization: "Bearer secret-token",
      cookie: "session=abc",
    };

    const redacted = redactSensitiveData(input);

    expect(redacted.user_email).toBe("user@example.com");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.api_token).toBe("[REDACTED]");
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.cookie).toBe("[REDACTED]");
  });

  it("redacts signed URLs in string values", () => {
    const input = {
      fileName: "invoice.pdf",
      url: "https://project.supabase.co/storage/v1/object/sign/dump-files/secret.pdf?token=eyJh...",
      secondary: "https://example.com/api?token=secret123",
    };

    const redacted = redactSensitiveData(input);

    expect(redacted.fileName).toBe("invoice.pdf");
    expect(redacted.url).toBe("[REDACTED]");
    expect(redacted.secondary).toBe("[REDACTED]");
  });

  it("recursively redacts nested objects", () => {
    const input = {
      context: {
        network: {
          ip: "127.0.0.1",
          bearer: "secret-token",
        },
        payload: {
          safeField: "safe",
          refresh_token: "rt-12345",
        },
      },
    };

    const redacted = redactSensitiveData(input) as any;

    expect(redacted.context.network.ip).toBe("127.0.0.1");
    expect(redacted.context.network.bearer).toBe("[REDACTED]");
    expect(redacted.context.payload.safeField).toBe("safe");
    expect(redacted.context.payload.refresh_token).toBe("[REDACTED]");
  });

  it("redacts sensitive strings inside arrays", () => {
    const input = {
      links: [
        "safe-string",
        "https://project.supabase.co/storage/v1/object/sign/file.txt?token=xyz",
      ],
      items: [
        { password: "abc", name: "item1" },
        { token: "def", name: "item2" },
      ],
    };

    const redacted = redactSensitiveData(input) as any;

    expect(redacted.links[0]).toBe("safe-string");
    expect(redacted.links[1]).toBe("[REDACTED]");
    expect(redacted.items[0].password).toBe("[REDACTED]");
    expect(redacted.items[0].name).toBe("item1");
    expect(redacted.items[1].token).toBe("[REDACTED]");
    expect(redacted.items[1].name).toBe("item2");
  });
});

describe("logAction", () => {
  let mockInsert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert = jest.fn().mockResolvedValue({ error: null });
    (createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        insert: mockInsert,
      }),
    });
  });

  it("writes audit action with redacted metadata and target information", async () => {
    await logAction({
      actor_user_id: "user-123",
      action: AUDIT_ACTIONS.FILE_UPLOAD_COMPLETED,
      target_type: "file",
      target_id: "file-456",
      target_name: "test.pdf",
      result: "SUCCESS",
      ip_address: "127.0.0.1",
      user_agent: "Jest Test",
      metadata: {
        sizeBytes: 1024,
        authorization: "Bearer secret",
      },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const payload = mockInsert.mock.calls[0][0];

    expect(payload.actor_id).toBe("user-123");
    expect(payload.action).toBe(AUDIT_ACTIONS.FILE_UPLOAD_COMPLETED);
    expect(payload.entity_type).toBe("file");
    expect(payload.entity_id).toBe("file-456");
    expect(payload.ip_address).toBe("127.0.0.1");
    expect(payload.user_agent).toBe("Jest Test");
    expect(payload.metadata.target_name).toBe("test.pdf");
    expect(payload.metadata.result).toBe("SUCCESS");
    expect(payload.metadata.authorization).toBe("[REDACTED]");
    expect(payload.metadata.sizeBytes).toBe(1024);
  });

  it("never throws even if the database insert fails", async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: "Database connection lost" },
    });

    await expect(
      logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.API_ERROR,
        target_type: "system",
        result: "FAILED",
      })
    ).resolves.not.toThrow();
  });

  it("never throws if client factory throws an exception", async () => {
    (createAdminClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    });

    await expect(
      logAction({
        actor_user_id: null,
        action: AUDIT_ACTIONS.SECURITY_UPLOAD_REJECTED,
        target_type: "security",
        result: "FAILED",
      })
    ).resolves.not.toThrow();
  });
});
