import { searchQuerySchema } from "@/lib/validation/schema";

describe("Search Query Schema", () => {
  it("validates basic search query with defaults", () => {
    const params = {
      q: "financial report",
    };
    const result = searchQuerySchema.safeParse(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("financial report");
      expect(result.data.type).toBe("all");
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts valid category types", () => {
    const validTypes = ["all", "files", "posts", "folders"] as const;
    for (const type of validTypes) {
      const result = searchQuerySchema.safeParse({
        q: "test",
        type,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe(type);
      }
    }
  });

  it("rejects unknown category type", () => {
    const result = searchQuerySchema.safeParse({
      q: "test",
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from query", () => {
    const result = searchQuerySchema.safeParse({
      q: "   quarterly budget   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("quarterly budget");
    }
  });

  it("rejects empty query string", () => {
    const result = searchQuerySchema.safeParse({
      q: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects queries exceeding 100 characters", () => {
    const longQuery = "a".repeat(101);
    const result = searchQuerySchema.safeParse({
      q: longQuery,
    });
    expect(result.success).toBe(false);
  });

  it("coerces string limit into integer", () => {
    const result = searchQuerySchema.safeParse({
      q: "invoice",
      limit: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects negative or 0 limit", () => {
    const result = searchQuerySchema.safeParse({
      q: "invoice",
      limit: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 100", () => {
    const result = searchQuerySchema.safeParse({
      q: "invoice",
      limit: "150",
    });
    expect(result.success).toBe(false);
  });
});
