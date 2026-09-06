import { z } from "zod";

/**
 * Zod validation schemas for domain models.
 * Used for validating user input before database operations.
 */

// ---- Profiles ----
export const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores"
    )
    .optional(),
  full_name: z
    .string()
    .max(100, "Full name must be at most 100 characters")
    .optional(),
  avatar_url: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
});

// ---- Content Lifecycle & Status ----
export const contentStatusSchema = z.enum(["active", "trash", "deleted"]);

export const folderCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(255, "Folder name is too long"),
  parent_id: z.string().uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
  status: contentStatusSchema.optional().default("active"),
});

export const folderUpdateSchema = folderCreateSchema.partial();

// ---- Files ----
export const fileUploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  folder_id: z.string().uuid().nullable().optional(),
  is_public: z.boolean().optional().default(false),
  status: contentStatusSchema.optional().default("active"),
});

export const fileSearchFilterSchema = z.object({
  query: z.string().max(100).optional(),
  extension: z.string().max(20).optional(),
  status: contentStatusSchema.optional().default("active"),
  folder_id: z.string().uuid().nullable().optional(),
});

// File CRUD (Day 5)
export const fileUpdateSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(255, "Display name is too long")
    .optional(),
  folder_id: z.string().uuid().nullable().optional(),
});

// Folder move with explicit parent target (Day 5)
export const folderMoveSchema = z.object({
  parent_id: z.string().uuid().nullable(),
});

// ---- Posts ----
export const postStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
  "trash",
  "deleted",
]);

export const postCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  slug: z
    .string()
    .max(200, "Slug is too long")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase with hyphens only"
    )
    .optional(),
  content: z.string().optional().default(""),
  excerpt: z.string().max(500, "Excerpt is too long").optional().default(""),
  status: postStatusSchema.optional().default("draft"),
  featured_image_url: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
});

export const postUpdateSchema = postCreateSchema.partial();

// ---- Search ----
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(100),
  type: z.enum(["all", "files", "posts", "folders"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ---- Authentication ----
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const updatePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
