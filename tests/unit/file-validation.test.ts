/**
 * Unit tests for File Storage & Upload Pipeline validation
 */

import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  extractExtension,
  sanitizeFilename,
  generateStoragePath,
  validateMagicBytes,
  validateUploadedFile,
  isExecutableSignature,
} from "@/lib/storage/file-validation";

describe("File Validation Module", () => {
  describe("Constants & Configuration", () => {
    it("enforces MAX_FILE_SIZE_BYTES to exactly 70 MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(70 * 1024 * 1024);
      expect(MAX_FILE_SIZE_BYTES).toBe(73400320);
    });

    it("includes all 14 permitted extensions in ALLOWED_EXTENSIONS whitelist", () => {
      const expected = [
        "pdf",
        "doc",
        "docx",
        "ppt",
        "pptx",
        "xls",
        "xlsx",
        "txt",
        "csv",
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
      ];
      for (const ext of expected) {
        expect(ALLOWED_EXTENSIONS).toContain(ext);
      }
      expect(ALLOWED_EXTENSIONS.length).toBe(14);
    });
  });

  describe("Filename sanitization and extension extraction", () => {
    it("extracts lowercase extension correctly", () => {
      expect(extractExtension("report.PDF")).toBe("pdf");
      expect(extractExtension("archive.data.tar.gz")).toBe("gz");
      expect(extractExtension("spreadsheet.XLSX")).toBe("xlsx");
      expect(extractExtension("no_extension")).toBe("");
    });

    it("sanitizes filenames stripping traversal paths, null bytes, and illegal chars", () => {
      expect(sanitizeFilename("../../secret/file.pdf")).not.toContain("../");
      expect(sanitizeFilename("invoice*2026?.pdf")).toBe("invoice_2026_.pdf");
      expect(sanitizeFilename("bad\x00name.png")).toBe("badname.png");
      expect(sanitizeFilename("   spaced.docx   ")).toBe("spaced.docx");
    });
  });

  describe("UUID Storage Path Generation", () => {
    it("generates an opaque UUID-based storage path with correct extension", () => {
      const path1 = generateStoragePath("pdf");
      const path2 = generateStoragePath("png");

      expect(path1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/
      );
      expect(path2).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
      );
      expect(path1).not.toBe(path2);
    });

    it("never includes user filename in storage path", () => {
      const path = generateStoragePath("docx");
      expect(path).not.toContain("report");
      expect(path.endsWith(".docx")).toBe(true);
    });
  });

  describe("Executable signature detection", () => {
    it("detects Windows PE MZ executable header", () => {
      const peBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
      expect(isExecutableSignature(peBuffer)).toBe(true);
    });

    it("detects Linux ELF executable header", () => {
      const elfBuffer = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02]);
      expect(isExecutableSignature(elfBuffer)).toBe(true);
    });

    it("returns false for legitimate document and image headers", () => {
      const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      const pngBuffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(isExecutableSignature(pdfBuffer)).toBe(false);
      expect(isExecutableSignature(pngBuffer)).toBe(false);
    });
  });

  describe("Magic bytes validation", () => {
    it("validates authentic PDF buffer", () => {
      const pdf = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
      ]); // %PDF-1.7
      const check = validateMagicBytes(pdf, "pdf");
      expect(check.valid).toBe(true);
    });

    it("validates authentic PNG buffer", () => {
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);
      const check = validateMagicBytes(png, "png");
      expect(check.valid).toBe(true);
    });

    it("validates authentic JPEG buffer", () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const check = validateMagicBytes(jpeg, "jpg");
      expect(check.valid).toBe(true);
    });

    it("validates authentic GIF87a and GIF89a buffers", () => {
      const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      const gif89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(validateMagicBytes(gif87, "gif").valid).toBe(true);
      expect(validateMagicBytes(gif89, "gif").valid).toBe(true);
    });

    it("validates authentic WEBP buffer", () => {
      // RIFF (4 bytes) + 4 bytes size + WEBP (4 bytes)
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
        0x50,
      ]);
      expect(validateMagicBytes(webp, "webp").valid).toBe(true);
    });

    it("validates authentic OpenXML (docx/xlsx/pptx) ZIP archive signature", () => {
      const zipDocx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(validateMagicBytes(zipDocx, "docx").valid).toBe(true);
      expect(validateMagicBytes(zipDocx, "xlsx").valid).toBe(true);
      expect(validateMagicBytes(zipDocx, "pptx").valid).toBe(true);
    });

    it("validates authentic Legacy Office CFBF signature", () => {
      const cfbfDoc = new Uint8Array([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
      ]);
      expect(validateMagicBytes(cfbfDoc, "doc").valid).toBe(true);
      expect(validateMagicBytes(cfbfDoc, "xls").valid).toBe(true);
      expect(validateMagicBytes(cfbfDoc, "ppt").valid).toBe(true);
    });

    it("rejects disguised executable renamed to .pdf", () => {
      // Windows executable MZ header disguised with .pdf name
      const fakePdf = new Uint8Array([
        0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      ]);
      const check = validateMagicBytes(fakePdf, "pdf");
      expect(check.valid).toBe(false);
      expect(check.reason).toBe("DISGUISED_EXECUTABLE");
    });

    it("rejects mismatched magic bytes (e.g. text file renamed to .png)", () => {
      const fakePng = new TextEncoder().encode("This is just plain text");
      const check = validateMagicBytes(fakePng, "png");
      expect(check.valid).toBe(false);
      expect(check.reason).toBe("MAGIC_BYTES_MISMATCH");
    });

    it("rejects binary null bytes in txt and csv files", () => {
      const binaryDisguisedAsTxt = new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64,
      ]);
      const check = validateMagicBytes(binaryDisguisedAsTxt, "txt");
      expect(check.valid).toBe(false);
      expect(check.reason).toBe("INVALID_TEXT_ENCODING");
    });
  });

  describe("End-to-end validateUploadedFile function", () => {
    it("rejects empty files (0 bytes)", () => {
      const emptyBuffer = new Uint8Array(0);
      const res = validateUploadedFile("test.pdf", emptyBuffer);
      expect(res.isValid).toBe(false);
      expect(res.securityReason).toBe("EMPTY_FILE");
    });

    it("rejects files exceeding 70 MB size limit", () => {
      // Simulate buffer of 70MB + 1 byte
      const fakeLargeBuffer = {
        length: 70 * 1024 * 1024 + 1,
      } as Uint8Array;
      const res = validateUploadedFile("large_video.pdf", fakeLargeBuffer);
      expect(res.isValid).toBe(false);
      expect(res.securityReason).toBe("SIZE_LIMIT_EXCEEDED");
    });

    it("rejects disallowed extensions (.exe, .sh, .bat, .php)", () => {
      const buffer = new TextEncoder().encode("echo dangerous");
      const res = validateUploadedFile("script.sh", buffer);
      expect(res.isValid).toBe(false);
      expect(res.securityReason).toBe("DISALLOWED_EXTENSION");
    });

    it("accepts valid PDF with proper headers and generates storage path", () => {
      const pdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0,
        0xd4, 0xc5, 0xd8,
      ]);
      const res = validateUploadedFile("Quarterly_Report_2026.pdf", pdfBytes);

      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("pdf");
      expect(res.mimeType).toBe("application/pdf");
      expect(res.sanitizedName).toBe("Quarterly_Report_2026.pdf");
      expect(res.storagePath).toBeDefined();
      expect(res.storagePath).toMatch(/^[0-9a-f-]+\.pdf$/);
    });

    it("accepts valid text and csv files", () => {
      const csvBytes = new TextEncoder().encode(
        "id,name,role\n1,Alice,admin\n2,Bob,user\n"
      );
      const res = validateUploadedFile("data_export.csv", csvBytes, "text/csv");

      expect(res.isValid).toBe(true);
      expect(res.extension).toBe("csv");
      expect(res.storagePath).toMatch(/^[0-9a-f-]+\.csv$/);
    });
  });
});
