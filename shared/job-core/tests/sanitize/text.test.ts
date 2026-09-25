import { describe, expect, it } from "vitest";
import * as sanitizeExports from "../../src/sanitize/index.js";
import { sanitizeText } from "../../src/sanitize/text.js";

describe("sanitizeText", () => {
  it("rejects input exceeding maxLength without truncation", () => {
    const res = sanitizeText("1234567890", { maxLength: 5, field: "summary" });
    expect(res).toEqual({
      ok: false,
      code: "INPUT_TOO_LARGE",
      field: "summary",
    });
  });

  it("normalizes unicode using NFKC", () => {
    // \uFB01 is 'fi' ligature -> normalized to 'fi'
    const res = sanitizeText("Of\uFB01ce Manager");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Office Manager");
      expect(res.changed).toBe(true);
      expect(res.warnings[0]?.code).toBe("CONTENT_SANITIZED");
    }
  });

  it("strips C0 and C1 control characters except newline, tab, cr", () => {
    const raw = "Line 1\x00\x08\x0B\x0C\x0E\x1F\x7F\x80\x9F\tLine 2\nLine 3";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Line 1\tLine 2\nLine 3");
      expect(res.changed).toBe(true);
    }
  });

  it("strips zero-width characters", () => {
    // U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+2060 (WJ), U+FEFF (BOM)
    const raw = "Re\u200Bqu\u200Cir\u200Ded\u2060 \uFEFFSkills";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Required Skills");
      expect(res.changed).toBe(true);
    }
  });

  it("strips bidi control characters", () => {
    // U+202A to U+202E, U+2066 to U+2069
    const raw = "Prefix \u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069Hidden\u202C Suffix";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Prefix Hidden Suffix");
      expect(res.changed).toBe(true);
    }
  });

  it("strips Unicode tag characters (ASCII smuggling)", () => {
    // U+E0000 to U+E007F
    const raw = "Engineer \u{E0001}\u{E0020}\u{E0041}\u{E007F}Lead";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Engineer Lead");
      expect(res.changed).toBe(true);
    }
  });

  it("drops script, style, noscript, and comment blocks with contents", () => {
    const raw = `
      <script>const secret = 'attack';</script>
      <style>body { display: none; }</style>
      <noscript>Please turn on JS</noscript>
      <!-- Hidden comment instructions -->
      <p>Clean text</p>
    `;
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Clean text");
    }
  });

  it("converts block tags and br tags to newlines", () => {
    const raw = "<h1>Title</h1><p>Para 1</p><div>Para 2<br/>Line 2</div>";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Title\n\nPara 1\n\nPara 2\nLine 2");
    }
  });

  it("decodes named and numeric HTML entities", () => {
    const raw = "Java &amp; Python &copy; 2026 &#65;&#66;&#x43; &lt;&gt;";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Java & Python © 2026 ABC <>");
    }
  });

  it("strips numeric entities that decode to forbidden characters", () => {
    // &#0; (null), &#x200B; (zero-width), &#xE0001; (tag char), &#x110000; (out of range), &#x202A; (bidi), &#x2066; (bidi)
    const raw = "Safe&#0;Text&#x200B;Here&#xE0001;End&#x110000;&#x202A;&#x2066;";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("SafeTextHereEnd");
    }
  });

  it("decodes allowed entities with code points above tag character range", () => {
    // &#xE0080; is U+E0080 (above tag character block, valid)
    const raw = "Valid &#xE0080; CodePoint";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Valid \u{E0080} CodePoint");
    }
  });

  it("normalizes CRLF and collapses 3+ blank lines to 2", () => {
    const raw = "Line 1\r\n\r\n\r\n\r\n\r\nLine 2\r\n";
    const res = sanitizeText(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("Line 1\n\n\nLine 2");
    }
  });

  it("returns changed=false when text is clean and unmodified", () => {
    const raw = "Senior Software Engineer";
    const res = sanitizeText(raw);
    expect(res).toEqual({
      ok: true,
      text: "Senior Software Engineer",
      changed: false,
      warnings: [],
    });
  });

  it("includes field name in warnings when content is sanitized", () => {
    const res = sanitizeText("Title  ", { field: "job_title" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings).toEqual([
        {
          code: "CONTENT_SANITIZED",
          message: "Content in 'job_title' was sanitized",
          field: "job_title",
        },
      ]);
    }
  });

  it("exports all expected functions and constants from barrel index", () => {
    expect(typeof sanitizeExports.sanitizeText).toBe("function");
    expect(typeof sanitizeExports.detectInjection).toBe("function");
    expect(typeof sanitizeExports.validateSourceUrl).toBe("function");
    expect(Array.isArray(sanitizeExports.INJECTION_PATTERNS)).toBe(true);
    expect(Array.isArray(sanitizeExports.NAUKRI_HOSTS)).toBe(true);
    expect(Array.isArray(sanitizeExports.INDEED_HOSTS)).toBe(true);
  });
});
