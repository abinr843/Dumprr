/**
 * Tests for sanitization utilities and XSS prevention (Day 7).
 */

import {
  escapeHtml,
  sanitizeText,
  sanitizeFilename,
  sanitizePostContent,
  sanitizeDisplayName,
} from "@/lib/security/sanitize";

describe("escapeHtml", () => {
  it("escapes special HTML characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
    expect(escapeHtml('Hello & "World"')).toBe(
      "Hello &amp; &quot;World&quot;"
    );
  });

  it("handles strings with no HTML special characters unchanged", () => {
    expect(escapeHtml("Simple plain text 123")).toBe("Simple plain text 123");
  });
});

describe("sanitizeText", () => {
  it("strips null bytes and non-printable control characters", () => {
    const dirty = "Hello\0 World\x01\x02\x07!";
    expect(sanitizeText(dirty)).toBe("Hello World!");
  });

  it("preserves newlines, carriage returns, and tabs", () => {
    const formatted = "Line 1\n\tIndented Line 2\r\nLine 3";
    expect(sanitizeText(formatted)).toBe("Line 1\n\tIndented Line 2\r\nLine 3");
  });
});

describe("sanitizeFilename", () => {
  it("strips path traversal sequences", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("../");
    expect(sanitizeFilename("..\\..\\windows\\system32")).not.toContain("..\\");
  });

  it("replaces filesystem-unsafe characters with underscores", () => {
    expect(sanitizeFilename("file:name?with*bad|chars.pdf")).toBe(
      "file_name_with_bad_chars.pdf"
    );
    expect(sanitizeFilename("path/to\\file.txt")).toBe("path_to_file.txt");
  });

  it("strips HTML tags from filenames", () => {
    expect(sanitizeFilename("<script>bad</script>.jpg")).toBe("bad.jpg");
  });

  it("removes leading dots to prevent hidden files", () => {
    expect(sanitizeFilename(".env")).toBe("env");
    expect(sanitizeFilename("...hidden.txt")).toBe("hidden.txt");
  });

  it("falls back to unnamed_file if all characters stripped", () => {
    expect(sanitizeFilename("")).toBe("unnamed_file");
    expect(sanitizeFilename("   ")).toBe("unnamed_file");
    expect(sanitizeFilename("...///:::***")).toBe("unnamed_file");
  });
});

describe("sanitizePostContent", () => {
  it("removes script tags and their content", () => {
    const input = "Hello <script>alert('pwned')</script> World";
    expect(sanitizePostContent(input)).toBe("Hello  World");
  });

  it("removes iframes and embed elements", () => {
    const input = 'Check this: <iframe src="http://evil.com"></iframe> Safe text';
    expect(sanitizePostContent(input)).toBe("Check this:  Safe text");
  });

  it("removes inline event handlers like onload, onerror, onclick", () => {
    const input = '<img src="valid.jpg" onerror="alert(1)" onclick="steal()" />';
    expect(sanitizePostContent(input)).not.toContain("onerror");
    expect(sanitizePostContent(input)).not.toContain("onclick");
  });

  it("removes javascript: and vbscript: URIs", () => {
    const input = '<a href="javascript:alert(1)">Click me</a>';
    expect(sanitizePostContent(input)).not.toContain("javascript:");
  });

  it("removes data: URIs containing text/html", () => {
    const input = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>';
    expect(sanitizePostContent(input)).not.toContain("data:text/html");
  });

  it("removes HTML comments", () => {
    const input = "Before <!-- secret comment --> After";
    expect(sanitizePostContent(input)).toBe("Before  After");
  });

  it("preserves safe multiline text formatting", () => {
    const safe = "Paragraph 1\n\nParagraph 2\n- Item 1\n- Item 2";
    expect(sanitizePostContent(safe)).toBe(safe);
  });
});

describe("sanitizeDisplayName", () => {
  it("removes HTML tags and path traversal while keeping spaces and unicode", () => {
    expect(sanitizeDisplayName("<b>My Folder</b>")).toBe("My Folder");
    expect(sanitizeDisplayName("../../Photos 2026 🎉")).toBe("Photos 2026 🎉");
  });

  it("returns Untitled for empty input", () => {
    expect(sanitizeDisplayName("")).toBe("Untitled");
    expect(sanitizeDisplayName("   ")).toBe("Untitled");
  });
});
