/**
 * Untrusted-text sanitizer.
 *
 * Implements deterministic sanitization pipeline per Doc 16 §3B and Threat Model T-01.
 */

import type { SanitizeOptions, SanitizeResult, SanitizeWarning } from "./types.js";

// eslint-disable-next-line no-control-regex -- Explicitly stripping C0 and C1 control characters for security sanitization
const C0_C1_EXCEPT_NL_TAB_CR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const BIDI_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;
const TAG_CHARS_REGEX = /[\u{E0000}-\u{E007F}]/gu;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&pound;": "£",
  "&euro;": "€",
  "&yen;": "¥",
  "&cent;": "¢",
  "&hellip;": "…",
  "&ndash;": "–",
  "&mdash;": "—",
  "&bull;": "•",
};

function isForbiddenCodePoint(cp: number): boolean {
  if (
    (cp >= 0 && cp <= 8) ||
    cp === 11 ||
    cp === 12 ||
    (cp >= 14 && cp <= 31) ||
    (cp >= 127 && cp <= 159)
  ) {
    return true;
  }
  if ((cp >= 0x200b && cp <= 0x200d) || cp === 0x2060 || cp === 0xfeff) {
    return true;
  }
  if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) {
    return true;
  }
  if (cp >= 0xe0000 && cp <= 0xe007f) {
    return true;
  }
  return false;
}

function decodeHtmlEntities(html: string): string {
  // Decode decimal numeric entities
  let decoded = html.replace(/&#([0-9]{1,7});?/g, (_match, dec: string) => {
    const cp = parseInt(dec, 10);
    if (isNaN(cp) || cp > 0x10ffff || isForbiddenCodePoint(cp)) {
      return "";
    }
    return String.fromCodePoint(cp);
  });

  // Decode hexadecimal numeric entities
  decoded = decoded.replace(/&#x([0-9a-fA-F]{1,6});?/g, (_match, hex: string) => {
    const cp = parseInt(hex, 16);
    if (isNaN(cp) || cp > 0x10ffff || isForbiddenCodePoint(cp)) {
      return "";
    }
    return String.fromCodePoint(cp);
  });

  // Decode standard named entities
  for (const [entity, replacement] of Object.entries(NAMED_ENTITIES)) {
    decoded = decoded.replaceAll(entity, replacement);
  }

  return decoded;
}

function stripHtml(input: string): string {
  // Drop script, style, noscript, and comments with their contents
  let text = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<script\b[\s\S]*$/gi, "");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<style\b[\s\S]*$/gi, "");
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<noscript\b[\s\S]*$/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<!--[\s\S]*$/g, "");

  // Convert block / line tags to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(?:p|div|tr|h[1-6])>/gi, "\n\n");
  text = text.replace(/<li\b[^>]*>/gi, "\n");

  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/<[^>]*$/g, "");

  // Decode named and numeric entities
  text = decodeHtmlEntities(text);

  return text;
}

function stripForbiddenUnicode(text: string): string {
  return text
    .replace(C0_C1_EXCEPT_NL_TAB_CR_REGEX, "")
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(BIDI_REGEX, "")
    .replace(TAG_CHARS_REGEX, "");
}

/**
 * Sanitizes untrusted text in strict pipeline order:
 * 1. Raw length check (never silently truncate)
 * 2. NFKC
 * 3. Remove C0/C1 controls except \n and \t
 * 4. Remove zero-width, bidi, and Unicode tag characters
 * 5. HTML -> text without DOM
 * 6. Normalize CRLF to LF
 * 7. Collapse 3+ blank lines to 2
 * 8. Trim
 */
export function sanitizeText(input: string, options?: SanitizeOptions): SanitizeResult {
  // 1. Length check on raw input
  if (options?.maxLength !== undefined && input.length > options.maxLength) {
    return {
      ok: false,
      code: "INPUT_TOO_LARGE",
      ...(options.field !== undefined ? { field: options.field } : {}),
    };
  }

  // 2. NFKC
  let text = input.normalize("NFKC");

  // 3 & 4. Remove C0/C1 controls (except \n, \t, \r), zero-width, bidi, tags
  text = stripForbiddenUnicode(text);

  // 5. HTML -> text
  text = stripHtml(text);

  // Re-run forbidden character strip in case entities decoded to them
  text = stripForbiddenUnicode(text);

  // 6. Normalize CRLF
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip trailing whitespace per line safely (linear time, no ReDoS)
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // 7. Collapse 3+ blank lines to 2 (max 2 empty lines = 3 consecutive newlines)
  text = text.replace(/\n{4,}/g, "\n\n\n");

  // 8. Trim
  text = text.trim();

  const changed = text !== input;
  const warnings: SanitizeWarning[] = changed
    ? [
        {
          code: "CONTENT_SANITIZED",
          message: options?.field
            ? `Content in '${options.field}' was sanitized`
            : "Content was sanitized",
          ...(options?.field !== undefined ? { field: options.field } : {}),
        },
      ]
    : [];

  return {
    ok: true,
    text,
    changed,
    warnings,
  };
}
