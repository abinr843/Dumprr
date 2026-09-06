import {
  PREVIEWABLE_EXTENSIONS,
  INLINE_MIME_TYPES,
  isExtensionPreviewable,
  getPreviewMimeType,
} from "@/lib/storage/preview";

describe("File Preview Capabilities", () => {
  describe("isExtensionPreviewable", () => {
    it("returns true for directly previewable formats (PDF, JPG, PNG, WEBP, GIF, TXT)", () => {
      const previewable = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "txt"];
      for (const ext of previewable) {
        expect(isExtensionPreviewable(ext)).toBe(true);
        // Also verify with leading dot
        expect(isExtensionPreviewable(`.${ext}`)).toBe(true);
        // Also verify case-insensitivity
        expect(isExtensionPreviewable(ext.toUpperCase())).toBe(true);
      }
    });

    it("returns false for non-previewable formats (DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV)", () => {
      const downloadOnly = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "zip", "exe"];
      for (const ext of downloadOnly) {
        expect(isExtensionPreviewable(ext)).toBe(false);
        expect(isExtensionPreviewable(`.${ext}`)).toBe(false);
      }
    });

    it("returns false for null, undefined, or empty string", () => {
      expect(isExtensionPreviewable(null)).toBe(false);
      expect(isExtensionPreviewable(undefined)).toBe(false);
      expect(isExtensionPreviewable("")).toBe(false);
    });
  });

  describe("getPreviewMimeType", () => {
    it("returns correct inline MIME types for previewable files", () => {
      expect(getPreviewMimeType("pdf")).toBe("application/pdf");
      expect(getPreviewMimeType("jpg")).toBe("image/jpeg");
      expect(getPreviewMimeType("jpeg")).toBe("image/jpeg");
      expect(getPreviewMimeType("png")).toBe("image/png");
      expect(getPreviewMimeType("webp")).toBe("image/webp");
      expect(getPreviewMimeType("gif")).toBe("image/gif");
      expect(getPreviewMimeType("txt")).toBe("text/plain");
    });

    it("handles leading dots and uppercase correctly", () => {
      expect(getPreviewMimeType(".PDF")).toBe("application/pdf");
      expect(getPreviewMimeType(".PNG")).toBe("image/png");
    });

    it("returns undefined for non-previewable formats", () => {
      expect(getPreviewMimeType("docx")).toBeUndefined();
      expect(getPreviewMimeType("xlsx")).toBeUndefined();
      expect(getPreviewMimeType(null)).toBeUndefined();
    });
  });

  describe("PREVIEWABLE_EXTENSIONS set", () => {
    it("contains exactly the required 7 extensions", () => {
      expect(PREVIEWABLE_EXTENSIONS.has("pdf")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("jpg")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("jpeg")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("png")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("webp")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("gif")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.has("txt")).toBe(true);
      expect(PREVIEWABLE_EXTENSIONS.size).toBe(7);
    });
  });
});
