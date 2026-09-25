import { describe, expect, it } from "vitest";
import { INDEED_HOSTS, NAUKRI_HOSTS, validateSourceUrl } from "../../src/sanitize/url.js";

describe("validateSourceUrl", () => {
  it("rejects non-string or empty inputs", () => {
    expect(validateSourceUrl(null as unknown as string)).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must be a non-empty string",
    });
    expect(validateSourceUrl("")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must be a non-empty string",
    });
  });

  it("rejects URLs exceeding 2048 characters", () => {
    const longUrl = `https://naukri.com/job?param=${"a".repeat(2050)}`;
    const res = validateSourceUrl(longUrl);
    expect(res).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL exceeds maximum length of 2048 characters",
    });
  });

  it("rejects URLs with backslashes or whitespace", () => {
    expect(validateSourceUrl("https://naukri.com\\evil.com")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must not contain backslashes",
    });
    expect(validateSourceUrl("https://naukri.com/ job")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "URL must not contain whitespace",
    });
  });

  it("rejects malformed URLs", () => {
    expect(validateSourceUrl("not-a-valid-url")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "Malformed URL",
    });
  });

  it("rejects non-HTTPS schemes", () => {
    const schemes = [
      "http://naukri.com/job",
      "ftp://naukri.com/job",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,payload",
    ];
    for (const url of schemes) {
      const res = validateSourceUrl(url);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain("Only HTTPS");
      }
    }
  });

  it("rejects URLs with userinfo credentials", () => {
    expect(validateSourceUrl("https://user:pass@naukri.com/job")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "Userinfo (credentials in URL) is not allowed",
    });
    expect(validateSourceUrl("https://user@naukri.com/job")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "Userinfo (credentials in URL) is not allowed",
    });
  });

  it("rejects non-443 explicit ports and allows 443", () => {
    expect(validateSourceUrl("https://naukri.com:8443/job")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "Explicit port must be 443",
    });
    expect(validateSourceUrl("https://naukri.com:80/job")).toEqual({
      ok: false,
      code: "UNSAFE_URL",
      reason: "Explicit port must be 443",
    });

    const res443 = validateSourceUrl("https://naukri.com:443/job", NAUKRI_HOSTS);
    expect(res443).toEqual({
      ok: true,
      url: "https://naukri.com/job",
      isOfficial: true,
    });
  });

  it("rejects IP literals including normalized decimal and hex forms", () => {
    const ips = [
      "https://127.0.0.1/admin",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.1/internal",
      "https://[::1]/debug",
      "https://2130706433/",
      "https://0x7f.1/",
    ];
    for (const url of ips) {
      const res = validateSourceUrl(url);
      expect(res).toEqual({
        ok: false,
        code: "UNSAFE_URL",
        reason: "IP address literals are not allowed",
      });
    }
  });

  it("rejects localhost and internal domain suffixes", () => {
    const internal = [
      "https://localhost/test",
      "https://dev.localhost/test",
      "https://service.local/test",
      "https://api.internal/test",
      "https://gateway.lan/test",
    ];
    for (const url of internal) {
      const res = validateSourceUrl(url);
      expect(res).toEqual({
        ok: false,
        code: "UNSAFE_URL",
        reason: "Local and internal hosts are not allowed",
      });
    }
  });

  it("matches official hosts with exact label and subdomain rules", () => {
    // Exact match
    expect(validateSourceUrl("https://naukri.com/job/123", NAUKRI_HOSTS)).toEqual({
      ok: true,
      url: "https://naukri.com/job/123",
      isOfficial: true,
    });

    // Subdomain match
    expect(validateSourceUrl("https://www.naukri.com/job/123", NAUKRI_HOSTS)).toEqual({
      ok: true,
      url: "https://www.naukri.com/job/123",
      isOfficial: true,
    });

    // Suffix spoof
    expect(validateSourceUrl("https://naukri.com.evil.io/job/123", NAUKRI_HOSTS)).toEqual({
      ok: true,
      url: "https://naukri.com.evil.io/job/123",
      isOfficial: false,
    });

    // Prefix spoof
    expect(validateSourceUrl("https://evilnaukri.com/job/123", NAUKRI_HOSTS)).toEqual({
      ok: true,
      url: "https://evilnaukri.com/job/123",
      isOfficial: false,
    });
  });

  it("supports Indeed official host variations", () => {
    expect(validateSourceUrl("https://indeed.com/viewjob", INDEED_HOSTS)).toEqual({
      ok: true,
      url: "https://indeed.com/viewjob",
      isOfficial: true,
    });
    expect(validateSourceUrl("https://in.indeed.com/viewjob", INDEED_HOSTS)).toEqual({
      ok: true,
      url: "https://in.indeed.com/viewjob",
      isOfficial: true,
    });
    expect(validateSourceUrl("https://indeed.co.in/viewjob", INDEED_HOSTS)).toEqual({
      ok: true,
      url: "https://indeed.co.in/viewjob",
      isOfficial: true,
    });
  });

  it("treats Punycode and IDN homographs as unofficial unless listed", () => {
    // Cyrillic 'а' in naukri.com
    const cyrillicUrl = "https://n\u0430ukri.com/job";
    const res = validateSourceUrl(cyrillicUrl, NAUKRI_HOSTS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isOfficial).toBe(false);
    }

    // Punycode explicitly listed
    const punycodeUrl = "https://xn--naukr-qqa.com/job";
    const resListed = validateSourceUrl(punycodeUrl, ["xn--naukr-qqa.com"]);
    expect(resListed.ok).toBe(true);
    if (resListed.ok) {
      expect(resListed.isOfficial).toBe(true);
    }
  });

  it("defaults to empty allowlist when omitted", () => {
    const res = validateSourceUrl("https://naukri.com/job");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isOfficial).toBe(false);
    }
  });

  it("handles trailing dot in FQDN properly", () => {
    const res = validateSourceUrl("https://naukri.com./job", NAUKRI_HOSTS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.isOfficial).toBe(true);
    }
  });
});
