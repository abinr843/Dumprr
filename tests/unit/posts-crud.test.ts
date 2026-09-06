import {
  postCreateSchema,
  postUpdateSchema,
  postStatusSchema,
} from "@/lib/validation/schema";

describe("Post Validation Schemas", () => {
  describe("postStatusSchema", () => {
    it("accepts valid post statuses", () => {
      const validStatuses = ["draft", "published", "archived", "trash", "deleted"];
      for (const status of validStatuses) {
        const result = postStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid status", () => {
      const result = postStatusSchema.safeParse("unknown_status");
      expect(result.success).toBe(false);
    });
  });

  describe("postCreateSchema", () => {
    it("validates a minimal valid post", () => {
      const payload = {
        title: "Announcing Version 2.0",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Announcing Version 2.0");
        expect(result.data.status).toBe("draft");
        expect(result.data.content).toBe("");
      }
    });

    it("validates a full post payload", () => {
      const payload = {
        title: "Release Notes: September 2026",
        slug: "release-notes-september-2026",
        content: "# What's New\n\n- File preview modal\n- Unified search",
        excerpt: "Highlights of the September 2026 release.",
        status: "published",
        featured_image_url: "https://example.com/banner.jpg",
        tags: ["release", "announcement"],
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("published");
        expect(result.data.tags).toHaveLength(2);
      }
    });

    it("rejects empty title", () => {
      const payload = {
        title: "   ",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects invalid slug format with spaces or capitals", () => {
      const payload = {
        title: "Valid Title",
        slug: "Invalid Slug With Spaces",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects slug with consecutive hyphens or trailing hyphens", () => {
      const payload = {
        title: "Valid Title",
        slug: "invalid--slug-",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts valid slug with lowercase letters, numbers, and hyphens", () => {
      const payload = {
        title: "Valid Title",
        slug: "valid-slug-123",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid featured image URL", () => {
      const payload = {
        title: "Valid Title",
        featured_image_url: "not-a-valid-url",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("accepts empty string for featured image URL", () => {
      const payload = {
        title: "Valid Title",
        featured_image_url: "",
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects post with too many tags", () => {
      const tags = Array.from({ length: 25 }, (_, i) => `tag-${i}`);
      const payload = {
        title: "Valid Title",
        tags,
      };
      const result = postCreateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("postUpdateSchema", () => {
    it("allows partial updates", () => {
      const payload = {
        title: "Updated Post Title",
      };
      const result = postUpdateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("allows updating only status", () => {
      const payload = {
        status: "archived",
      };
      const result = postUpdateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid partial field", () => {
      const payload = {
        status: "non-existent-status",
      };
      const result = postUpdateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
