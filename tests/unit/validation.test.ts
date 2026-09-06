/**
 * Unit tests for Zod validation schemas.
 */

import {
  profileUpdateSchema,
  folderCreateSchema,
  postCreateSchema,
} from "@/lib/validation/schema";

describe("Validation Schemas", () => {
  describe("profileUpdateSchema", () => {
    it("accepts valid username", () => {
      const result = profileUpdateSchema.safeParse({ username: "john_doe" });
      expect(result.success).toBe(true);
    });

    it("rejects short username", () => {
      const result = profileUpdateSchema.safeParse({ username: "ab" });
      expect(result.success).toBe(false);
    });

    it("rejects username with spaces", () => {
      const result = profileUpdateSchema.safeParse({
        username: "john doe",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty update (all fields optional)", () => {
      const result = profileUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("folderCreateSchema", () => {
    it("accepts valid folder", () => {
      const result = folderCreateSchema.safeParse({ name: "My Documents" });
      expect(result.success).toBe(true);
    });

    it("rejects empty folder name", () => {
      const result = folderCreateSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("validates hex color format", () => {
      expect(
        folderCreateSchema.safeParse({ name: "Test", color: "#ff0000" }).success
      ).toBe(true);
      expect(
        folderCreateSchema.safeParse({ name: "Test", color: "red" }).success
      ).toBe(false);
    });
  });

  describe("postCreateSchema", () => {
    it("accepts valid post", () => {
      const result = postCreateSchema.safeParse({
        title: "My First Post",
        slug: "my-first-post",
        content: "Hello world",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid slug", () => {
      const result = postCreateSchema.safeParse({
        title: "Test",
        slug: "Invalid Slug!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects too many tags", () => {
      const result = postCreateSchema.safeParse({
        title: "Test",
        slug: "test",
        tags: Array(21).fill("tag"),
      });
      expect(result.success).toBe(false);
    });

    it("defaults status to draft", () => {
      const result = postCreateSchema.parse({
        title: "Test",
        slug: "test",
      });
      expect(result.status).toBe("draft");
    });
  });
});
