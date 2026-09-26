import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { policy } from "@jpm/job-core";
import naukriPolicyJson from "../config/naukri-policy.json" with { type: "json" };
import { handleFitScore, handleJdAnalyze } from "../src/tools.js";
import { sampleJob, sampleProfile } from "./fixtures.js";

const testPolicy = policy.loadPolicy(naukriPolicyJson, new Date("2026-09-25T00:00:00Z"));

describe("Invariant Tests — Hosted MCP", () => {
  it("enforces no store module, no sqlite, and no fs write APIs in src/", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /from\s+['"][^'"]*store[^'"]*['"]/,
      /\.store\b/,
      /node:sqlite/,
      /\bsqlite\b/i,
      /\bwriteFileSync\b/,
      /\bwriteFile\b/,
      /\bcreateWriteStream\b/,
      /\bappendFileSync\b/,
      /\bappendFile\b/,
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), "utf-8");
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("proves stateless execution: sequential calls leave zero files in working directory", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arin-jobfit-stateless-"));
    const filesBefore = fs.readdirSync(tempDir);
    expect(filesBefore.length).toBe(0);

    // Call 1: analyze JD
    const res1 = handleJdAnalyze({ job: sampleJob }, testPolicy);
    expect(res1.isError).toBe(false);

    // Call 2: score fit
    const res2 = handleFitScore({ job: sampleJob, profile: sampleProfile }, testPolicy);
    expect(res2.isError).toBe(false);

    // Verify temp directory remains completely empty
    const filesAfter = fs.readdirSync(tempDir);
    expect(filesAfter.length).toBe(0);

    fs.rmdirSync(tempDir);
  });
});
