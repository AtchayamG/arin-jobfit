/**
 * Source URL validator.
 *
 * Implements WHATWG URL validation and SSRF protection per Doc 16 §3B and Threat Model T-05.
 * Strictly pure: NEVER performs network requests or DNS resolution.
 */

import type { ValidateUrlResult } from "./types.js";

export const NAUKRI_HOSTS: readonly string[] = ["naukri.com"];
export const INDEED_HOSTS: readonly string[] = ["indeed.com", "indeed.co.in"];

const MAX_URL_LENGTH = 2048;

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isIpLiteral(hostname: string): boolean {
  if (IPV4_REGEX.test(hostname)) {
    return true;
  }
  if (hostname.includes(":")) {
    return true;
  }
  return false;
}

function isLocalOrInternal(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".lan")) {
    return true;
  }
  return false;
}

function isOfficialHost(hostname: string, allowlist: readonly string[]): boolean {
  const isPunycode = hostname.startsWith("xn--") || hostname.includes(".xn--");

  for (const entry of allowlist) {
    const allowed = entry.toLowerCase();
    // Punycode/IDN hosts are never official unless explicitly listed as Punycode
    if (isPunycode && !allowed.includes("xn--")) {
      continue;
    }
    if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a source URL against security policies and host allowlists.
 *
 * Rules:
 * - Length <= 2048 characters
 * - No backslashes or whitespace
 * - WHATWG parseable
 * - HTTPS protocol only
 * - No userinfo (credentials)
 * - Port 443 only (or default HTTPS port)
 * - No IP address literals (IPv4/IPv6/decimal/hex/octal)
 * - No localhost or internal/private domain suffixes (.local, .internal, .lan)
 * - Official status requires exact label match or subdomain of allowlist
 * - Punycode/IDN domains are never official unless explicitly listed
 */
export function validateSourceUrl(
  raw: string,
  allowlist: readonly string[] = [],
): ValidateUrlResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must be a non-empty string",
    };
  }

  if (raw.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: `URL exceeds maximum length of ${String(MAX_URL_LENGTH)} characters`,
    };
  }

  if (raw.includes("\\")) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must not contain backslashes",
    };
  }

  if (/\s/.test(raw)) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must not contain whitespace",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "Malformed URL",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "Only HTTPS protocol is allowed",
    };
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "Userinfo (credentials in URL) is not allowed",
    };
  }

  if (parsed.port !== "" && parsed.port !== "443") {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "Explicit port must be 443",
    };
  }

  let hostname = parsed.hostname.toLowerCase();
  // Strip trailing dot if FQDN
  if (hostname.endsWith(".")) {
    hostname = hostname.slice(0, -1);
  }

  if (isIpLiteral(hostname)) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "IP address literals are not allowed",
    };
  }

  if (isLocalOrInternal(hostname)) {
    return {
      ok: false,
      code: "UNSAFE_URL",
      reason: "Local and internal hosts are not allowed",
    };
  }

  const isOfficial = isOfficialHost(hostname, allowlist);

  return {
    ok: true,
    url: parsed.href,
    isOfficial,
  };
}
