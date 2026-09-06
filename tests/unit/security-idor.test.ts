/**
 * Tests for IDOR protections and resource authorization guards (Day 7).
 */

import {
  verifyFileAccess,
  verifyPostAccess,
  verifyFolderAccess,
} from "@/lib/permissions/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

describe("verifyFileAccess (IDOR Protection)", () => {
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockIs: jest.Mock;
  let mockSingle: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSingle = jest.fn();
    mockIs = jest.fn().mockReturnValue({ single: mockSingle });
    mockEq = jest.fn();

    // Chainable eq
    mockEq.mockImplementation((field: string, val: any) => {
      if (field === "id") {
        return {
          single: mockSingle,
          eq: (f2: string, v2: any) => ({
            is: mockIs,
            single: mockSingle,
          }),
        };
      }
      return { single: mockSingle, is: mockIs };
    });

    mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    (createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    });
  });

  it("allows admin access to any file without status restriction", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "file-1", status: "trash", deleted_at: "2026-09-01" },
    });

    const file = await verifyFileAccess("file-1", true);
    expect(file).toBeDefined();
    expect(file.id).toBe("file-1");
  });

  it("denies non-admin access when file is not active or is in trash", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
    });

    const file = await verifyFileAccess("file-trashed", false);
    expect(file).toBeNull();
  });
});

describe("verifyPostAccess (IDOR Protection)", () => {
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockIs: jest.Mock;
  let mockSingle: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSingle = jest.fn();
    mockIs = jest.fn().mockReturnValue({ single: mockSingle });
    mockEq = jest.fn();

    mockEq.mockImplementation((field: string, val: any) => {
      if (field === "id") {
        return {
          single: mockSingle,
          eq: (f2: string, v2: any) => ({
            is: mockIs,
            single: mockSingle,
          }),
        };
      }
      return { single: mockSingle, is: mockIs };
    });

    mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    (createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    });
  });

  it("allows admin access to draft and unpublished posts", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "post-1", status: "draft", title: "Unpublished Draft" },
    });

    const post = await verifyPostAccess("post-1", true);
    expect(post).toBeDefined();
    expect(post.status).toBe("draft");
  });

  it("denies non-admin access to draft or deleted posts", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
    });

    const post = await verifyPostAccess("post-draft", false);
    expect(post).toBeNull();
  });
});

describe("verifyFolderAccess (IDOR Protection)", () => {
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockIs: jest.Mock;
  let mockSingle: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSingle = jest.fn();
    mockIs = jest.fn().mockReturnValue({ single: mockSingle });
    mockEq = jest.fn();

    mockEq.mockImplementation((field: string, val: any) => {
      if (field === "id") {
        return {
          single: mockSingle,
          eq: (f2: string, v2: any) => ({
            is: mockIs,
            single: mockSingle,
          }),
        };
      }
      return { single: mockSingle, is: mockIs };
    });

    mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    (createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    });
  });

  it("allows admin access to trashed folders", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "folder-1", status: "trash", name: "Archived" },
    });

    const folder = await verifyFolderAccess("folder-1", true);
    expect(folder).toBeDefined();
    expect(folder.id).toBe("folder-1");
  });

  it("denies non-admin access to trashed folders", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
    });

    const folder = await verifyFolderAccess("folder-trashed", false);
    expect(folder).toBeNull();
  });
});
