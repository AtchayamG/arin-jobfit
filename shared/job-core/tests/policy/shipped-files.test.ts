import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { lintPolicy, loadPolicy } from "../../src/policy/index.js";

describe("WP-SH-002: Shipped Policy Files Verification", () => {
  const rootDir = path.resolve(process.cwd(), "../..");
  const naukriPolicyPath = path.join(rootDir, "naukri-mcp/config/policy.json");
  const indeedPolicyPath = path.join(rootDir, "indeed-mcp/config/policy.json");
  const decisionsLogPath = path.join(rootDir, "Docs/09_DECISIONS_LOG.md");

  const now = new Date("2026-09-25T13:30:00Z");

  it("verifies naukri-mcp shipped policy file", () => {
    expect(fs.existsSync(naukriPolicyPath)).toBe(true);
    const rawContent: unknown = JSON.parse(fs.readFileSync(naukriPolicyPath, "utf-8"));
    const policy = loadPolicy(rawContent, now);

    expect(policy.policy_version).toBe("1");
    expect(policy.product).toBe("naukri-mcp");
    expect(policy.provider).toBe("naukri");
    expect(policy.snapshot_date).toBe("2026-09-25");
    expect(policy.stale_after_days).toBe(90);
    expect(policy.partner_approval_recorded).toBe(false);

    // Verify no capability above L0 is enabled
    for (const cap of policy.capabilities) {
      if (cap.level !== "L0") {
        expect(cap.status).not.toBe("enabled");
      }
      expect(cap.reason.length).toBeLessThanOrEqual(300);
      expect(cap.sources.length).toBeGreaterThan(0);
      for (const src of cap.sources) {
        expect(src.startsWith("https://")).toBe(true);
      }
    }

    const logText = fs.readFileSync(decisionsLogPath, "utf-8");
    const lintResults = lintPolicy(policy, logText);
    const errors = lintResults.filter((r) => r.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("verifies indeed-mcp shipped policy file", () => {
    expect(fs.existsSync(indeedPolicyPath)).toBe(true);
    const rawContent: unknown = JSON.parse(fs.readFileSync(indeedPolicyPath, "utf-8"));
    const policy = loadPolicy(rawContent, now);

    expect(policy.policy_version).toBe("1");
    expect(policy.product).toBe("indeed-mcp");
    expect(policy.provider).toBe("indeed");
    expect(policy.snapshot_date).toBe("2026-09-25");
    expect(policy.stale_after_days).toBe(90);
    expect(policy.partner_approval_recorded).toBe(false);

    // Verify no capability above L0 is enabled
    for (const cap of policy.capabilities) {
      if (cap.level !== "L0") {
        expect(cap.status).not.toBe("enabled");
      }
      expect(cap.reason.length).toBeLessThanOrEqual(300);
      expect(cap.sources.length).toBeGreaterThan(0);
      for (const src of cap.sources) {
        expect(src.startsWith("https://")).toBe(true);
      }
    }

    const logText = fs.readFileSync(decisionsLogPath, "utf-8");
    const lintResults = lintPolicy(policy, logText);
    const errors = lintResults.filter((r) => r.level === "error");
    expect(errors).toHaveLength(0);
  });
});
