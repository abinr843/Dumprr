/**
 * Tests for folder hierarchy utilities — breadcrumb type contracts
 * and audit action enumeration completeness.
 */

import { AUDIT_ACTIONS } from "@/types/audit";
import type { BreadcrumbItem, FolderWithStats, TrashItem } from "@/types/storage";

// ─── BreadcrumbItem Type Contract ─────────────────────────────────────

describe("BreadcrumbItem type contract", () => {
  it("root breadcrumb has null id and 'Home' name", () => {
    const root: BreadcrumbItem = { id: null, name: "Home" };
    expect(root.id).toBeNull();
    expect(root.name).toBe("Home");
  });

  it("nested breadcrumb has a UUID id", () => {
    const crumb: BreadcrumbItem = {
      id: "abc-123",
      name: "Documents",
    };
    expect(crumb.id).toBe("abc-123");
    expect(crumb.name).toBe("Documents");
  });

  it("a full breadcrumb path is an array", () => {
    const path: BreadcrumbItem[] = [
      { id: null, name: "Home" },
      { id: "folder-1", name: "Documents" },
      { id: "folder-2", name: "Project Alpha" },
    ];
    expect(path).toHaveLength(3);
    expect(path[0].id).toBeNull();
    expect(path[2].name).toBe("Project Alpha");
  });
});

// ─── FolderWithStats Type Contract ────────────────────────────────────

describe("FolderWithStats enrichment", () => {
  it("includes childFolderCount and childFileCount", () => {
    const folder: Partial<FolderWithStats> = {
      id: "folder-1",
      name: "Documents",
      childFolderCount: 3,
      childFileCount: 12,
    };
    expect(folder.childFolderCount).toBe(3);
    expect(folder.childFileCount).toBe(12);
  });

  it("includes breadcrumbs array", () => {
    const folder: Partial<FolderWithStats> = {
      id: "folder-2",
      name: "Receipts",
      breadcrumbs: [
        { id: null, name: "Home" },
        { id: "folder-1", name: "Documents" },
        { id: "folder-2", name: "Receipts" },
      ],
    };
    expect(folder.breadcrumbs).toHaveLength(3);
    expect(folder.breadcrumbs![0].name).toBe("Home");
  });
});

// ─── TrashItem Type Contract ──────────────────────────────────────────

describe("TrashItem type contract", () => {
  it("file trash item has required fields", () => {
    const item: TrashItem = {
      id: "file-1",
      type: "file",
      name: "report.pdf",
      sizeBytes: 1024,
      extension: "pdf",
      deletedAt: "2024-01-01T00:00:00Z",
      expiresAt: "2024-01-08T00:00:00Z",
      daysRemaining: 7,
      hoursRemaining: 168,
      isExpired: false,
    };
    expect(item.type).toBe("file");
    expect(item.extension).toBe("pdf");
    expect(item.isExpired).toBe(false);
  });

  it("folder trash item has color and type folder", () => {
    const item: TrashItem = {
      id: "folder-1",
      type: "folder",
      name: "Old Documents",
      color: "#10b981",
      deletedAt: "2024-01-01T00:00:00Z",
      expiresAt: "2024-01-08T00:00:00Z",
      daysRemaining: 5,
      hoursRemaining: 120,
      isExpired: false,
    };
    expect(item.type).toBe("folder");
    expect(item.color).toBe("#10b981");
  });
});

// ─── Audit Actions Completeness ──────────────────────────────────────

describe("AUDIT_ACTIONS completeness for Day 5", () => {
  it("has all file lifecycle actions", () => {
    expect(AUDIT_ACTIONS.FILE_RENAMED).toBe("file.renamed");
    expect(AUDIT_ACTIONS.FILE_MOVED).toBe("file.moved");
    expect(AUDIT_ACTIONS.FILE_DELETED).toBe("file.deleted");
    expect(AUDIT_ACTIONS.FILE_RESTORED).toBe("file.restored");
    expect(AUDIT_ACTIONS.FILE_PERMANENTLY_DELETED).toBe(
      "file.permanently_deleted"
    );
  });

  it("has all folder lifecycle actions", () => {
    expect(AUDIT_ACTIONS.FOLDER_CREATED).toBe("folder.created");
    expect(AUDIT_ACTIONS.FOLDER_RENAMED).toBe("folder.renamed");
    expect(AUDIT_ACTIONS.FOLDER_MOVED).toBe("folder.moved");
    expect(AUDIT_ACTIONS.FOLDER_DELETED).toBe("folder.deleted");
    expect(AUDIT_ACTIONS.FOLDER_RESTORED).toBe("folder.restored");
    expect(AUDIT_ACTIONS.FOLDER_PERMANENTLY_DELETED).toBe(
      "folder.permanently_deleted"
    );
  });

  it("has PERMISSION_DENIED security action", () => {
    expect(AUDIT_ACTIONS.PERMISSION_DENIED).toBe(
      "security.permission_denied"
    );
  });

  it("retains backward-compatible upload actions", () => {
    expect(AUDIT_ACTIONS.FILE_UPLOAD_STARTED).toBe("file.upload_started");
    expect(AUDIT_ACTIONS.FILE_UPLOAD_COMPLETED).toBe("file.upload_completed");
    expect(AUDIT_ACTIONS.FILE_UPLOAD_FAILED).toBe("file.upload_failed");
    expect(AUDIT_ACTIONS.FILE_UPLOAD_REJECTED).toBe("file.upload_rejected");
  });
});

// ─── Cycle Detection Logic (Pure Unit Test) ──────────────────────────

describe("Cycle detection - pure logic", () => {
  /**
   * Simulates the cycle detection that runs in the folders API.
   * Given a tree structure, determines if `targetId` is a descendant of `ancestorId`.
   */
  function isDescendantOf(
    tree: Record<string, string | null>,
    targetId: string,
    ancestorId: string
  ): boolean {
    let currentId: string | null = targetId;
    for (let depth = 0; depth < 50 && currentId; depth++) {
      if (currentId === ancestorId) return true;
      currentId = tree[currentId] ?? null;
    }
    return false;
  }

  const tree: Record<string, string | null> = {
    A: null,
    B: "A",
    C: "B",
    D: "C",
    E: "A",
  };

  it("detects that C is a descendant of A", () => {
    expect(isDescendantOf(tree, "C", "A")).toBe(true);
  });

  it("detects that D is a descendant of A", () => {
    expect(isDescendantOf(tree, "D", "A")).toBe(true);
  });

  it("detects that D is a descendant of B", () => {
    expect(isDescendantOf(tree, "D", "B")).toBe(true);
  });

  it("correctly identifies non-descendants", () => {
    expect(isDescendantOf(tree, "E", "B")).toBe(false);
  });

  it("root is not a descendant of any child", () => {
    expect(isDescendantOf(tree, "A", "D")).toBe(false);
  });

  it("node is a descendant of itself", () => {
    expect(isDescendantOf(tree, "A", "A")).toBe(true);
  });

  it("prevents moving C into D (cycle)", () => {
    // C -> B -> A; D -> C -> B -> A
    // If we try to move C's parent to D, D is a descendant of C → cycle!
    expect(isDescendantOf(tree, "D", "C")).toBe(true);
  });

  it("allows moving E under D (no cycle)", () => {
    // E -> A, D -> C -> B -> A
    // E is not a descendant of D, so moving D under E is fine
    expect(isDescendantOf(tree, "E", "D")).toBe(false);
  });
});
