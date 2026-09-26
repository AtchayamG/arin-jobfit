import http, { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policy } from "@jpm/job-core";
import naukriPolicyJson from "../config/naukri-policy.json" with { type: "json" };
import { createRequestHandler } from "../src/http.js";
import { readBodyWithLimit, TokenBucketRateLimiter, validateHostHeader } from "../src/security.js";
import {
  handleApplicationHandoff,
  handleCvNotes,
  handleFitScore,
  handleInterviewPrep,
  handleJdAnalyze,
} from "../src/tools.js";
import { resolveJob, resolveProfile } from "../src/resolve.js";
import { createHostedMcpServer, createIndeedServer, createNaukriServer } from "../src/server.js";
import { sampleJob, sampleProfile } from "./fixtures.js";

const testPolicy = policy.loadPolicy(naukriPolicyJson, new Date("2026-09-25T00:00:00Z"));

describe("Edge Cases and Failure Paths", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const handler = createRequestHandler({
      policy: testPolicy,
      isProduction: false,
    });
    server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(addr.port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it("handles 404 for unknown endpoints", async () => {
    const res = await fetch(`${baseUrl}/unknown-route`);
    expect(res.status).toBe(404);
  });

  it("tests host validation edge cases", () => {
    expect(validateHostHeader(undefined, undefined, false)).toBe(false);
    expect(validateHostHeader("", undefined, false)).toBe(false);
    expect(validateHostHeader("example.com", undefined, true)).toBe(false);
    expect(validateHostHeader("allowed.com:8080", "allowed.com", true)).toBe(true);
  });

  it("cleans up expired buckets in rate limiter", () => {
    const limiter = new TokenBucketRateLimiter(10, 10);
    limiter.consume("1.2.3.4", 1000);
    // Simulate advance past cleanup threshold (>300s) and expiration (>600s)
    const futureTime = 1000 + 700_000;
    limiter.consume("5.6.7.8", futureTime);
    // 1.2.3.4 should have been cleaned up
    const res = limiter.consume("1.2.3.4", futureTime);
    expect(res.allowed).toBe(true);
  });

  it("rejects readBodyWithLimit on stream error", async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error("Stream failure"));
      },
    }) as unknown as http.IncomingMessage;
    stream.headers = {};
    await expect(readBodyWithLimit(stream)).rejects.toThrow("Stream failure");
  });

  it("covers tool fast paths: already resolved Job and Profile objects", () => {
    const resolvedJob = resolveJob(sampleJob, "naukri");
    const fastJob = resolveJob(resolvedJob.job);
    expect(fastJob.job.job_id).toBe(resolvedJob.job.job_id);

    const resolvedProf = resolveProfile(sampleProfile);
    const fastProf = resolveProfile(resolvedProf.profile);
    expect(fastProf.profile.profile_id).toBe(resolvedProf.profile.profile_id);
  });

  it("covers provider: indeed in jd_analyze", () => {
    const indeedJob = {
      ...sampleJob,
      source_url: "https://www.indeed.com/viewjob?jk=12345",
    };
    const res = handleJdAnalyze({ job: indeedJob }, testPolicy, new Date(), "indeed");
    expect(res.isError).toBe(false);
    const data = res.structuredContent.data as { job: { provider: string } };
    expect(data.job.provider).toBe("indeed");
  });

  it("catches invalid inputs gracefully across tools", () => {
    const brokenJob = { description: "" } as unknown as Parameters<
      typeof handleJdAnalyze
    >[0]["job"];

    const r1 = handleJdAnalyze({ job: brokenJob }, testPolicy);
    expect(r1.isError).toBe(true);

    const r2 = handleFitScore({ job: brokenJob, profile: sampleProfile }, testPolicy);
    expect(r2.isError).toBe(true);

    const r3 = handleCvNotes({ job: brokenJob, profile: sampleProfile }, testPolicy);
    expect(r3.isError).toBe(true);

    const r4 = handleInterviewPrep({ job: brokenJob, profile: sampleProfile }, testPolicy);
    expect(r4.isError).toBe(true);

    const r5 = handleApplicationHandoff({ job: brokenJob }, testPolicy);
    expect(r5.isError).toBe(true);
  });

  it("verifies server creation helpers", () => {
    const s1 = createHostedMcpServer(testPolicy);
    expect(s1).toBeDefined();
    const s2 = createNaukriServer(testPolicy);
    expect(s2).toBeDefined();
    const s3 = createIndeedServer(testPolicy);
    expect(s3).toBeDefined();
  });
});
