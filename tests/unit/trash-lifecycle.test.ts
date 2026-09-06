/**
 * Tests for trash lifecycle calculations and expiration logic.
 */

import { calculateTrashExpiration } from "@/lib/storage/trash";
import {
  fileUpdateSchema,
  folderCreateSchema,
  folderUpdateSchema,
  folderMoveSchema,
} from "@/lib/validation/schema";

// ─── calculateTrashExpiration ─────────────────────────────────────────

describe("calculateTrashExpiration", () => {
  it("returns 7 days remaining for an item just deleted", () => {
    const now = new Date();
    const result = calculateTrashExpiration(now.toISOString());

    // Should be around 7 days (168 hours) remaining
    expect(result.daysRemaining).toBe(7);
    expect(result.hoursRemaining).toBeGreaterThanOrEqual(167);
    expect(result.hoursRemaining).toBeLessThanOrEqual(168);
    expect(result.isExpired).toBe(false);
  });

  it("returns correct countdown for item deleted 3 days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = calculateTrashExpiration(threeDaysAgo.toISOString());

    expect(result.daysRemaining).toBe(4);
    expect(result.isExpired).toBe(false);
  });

  it("returns correct countdown for item deleted 6 days ago", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const result = calculateTrashExpiration(sixDaysAgo.toISOString());

    expect(result.daysRemaining).toBe(1);
    expect(result.isExpired).toBe(false);
  });

  it("returns expired for item deleted 8 days ago", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = calculateTrashExpiration(eightDaysAgo.toISOString());

    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(0);
    expect(result.isExpired).toBe(true);
  });

  it("returns expired for item deleted exactly 7 days ago", () => {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000
    );
    const result = calculateTrashExpiration(sevenDaysAgo.toISOString());

    expect(result.isExpired).toBe(true);
  });

  it("generates a valid expiresAt ISO string", () => {
    const now = new Date();
    const result = calculateTrashExpiration(now.toISOString());

    const expiresDate = new Date(result.expiresAt);
    expect(expiresDate.getTime()).toBeGreaterThan(now.getTime());
    expect(result.expiresAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });
});

// ─── Validation Schemas ─────────────────────────────────────────────

describe("fileUpdateSchema", () => {
  it("accepts a valid display_name", () => {
    const result = fileUpdateSchema.safeParse({
      display_name: "Quarterly Report.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid folder_id", () => {
    const result = fileUpdateSchema.safeParse({
      folder_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null folder_id (move to root)", () => {
    const result = fileUpdateSchema.safeParse({ folder_id: null });
    expect(result.success).toBe(true);
  });

  it("rejects an empty display_name", () => {
    const result = fileUpdateSchema.safeParse({ display_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid folder_id", () => {
    const result = fileUpdateSchema.safeParse({ folder_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts empty object (no changes)", () => {
    const result = fileUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("folderCreateSchema", () => {
  it("accepts a valid folder creation", () => {
    const result = folderCreateSchema.safeParse({
      name: "Documents",
      color: "#10b981",
    });
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    const result = folderCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = folderCreateSchema.safeParse({ name: "  " });
    expect(result.success).toBe(false);
  });

  it("validates hex color format", () => {
    const result = folderCreateSchema.safeParse({
      name: "Test",
      color: "not-a-color",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid parent_id UUID", () => {
    const result = folderCreateSchema.safeParse({
      name: "Subfolder",
      parent_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null parent_id (root folder)", () => {
    const result = folderCreateSchema.safeParse({
      name: "Root Folder",
      parent_id: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("folderUpdateSchema", () => {
  it("accepts partial updates", () => {
    const result = folderUpdateSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("accepts color-only update", () => {
    const result = folderUpdateSchema.safeParse({ color: "#f43f5e" });
    expect(result.success).toBe(true);
  });

  it("accepts empty update (no changes)", () => {
    const result = folderUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("folderMoveSchema", () => {
  it("accepts a valid parent_id", () => {
    const result = folderMoveSchema.safeParse({
      parent_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null parent_id (move to root)", () => {
    const result = folderMoveSchema.safeParse({ parent_id: null });
    expect(result.success).toBe(true);
  });

  it("requires parent_id field", () => {
    const result = folderMoveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID", () => {
    const result = folderMoveSchema.safeParse({ parent_id: "invalid" });
    expect(result.success).toBe(false);
  });
});
