import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { testClient, jobInput, profileInput } from "../mcp/client.js";
import { asEnvelope } from "./helpers.js";

describe("T-06 & T-07: DoS / ReDoS prevention and SQL injection defenses", () => {
  it("T-06: rejects payloads exceeding size limits with INPUT_TOO_LARGE", async () => {
    const { client, close } = await testClient();
    try {
      // 55,000 chars exceeds the 50,000 char description limit
      const oversizedDescription = "A".repeat(55_000);
      const res = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...jobInput,
            description: oversizedDescription,
          },
        },
      });
      expect(res.isError).toBe(true);
      if (res.structuredContent) {
        const content = asEnvelope(res);
        expect(content.status).toBe("error");
        expect(content.error?.code).toBe("INPUT_TOO_LARGE");
      } else {
        const first = res.content[0];
        const text = first && "text" in first && typeof first.text === "string" ? first.text : "";
        expect(text).toMatch(/too_big|50000|INPUT_TOO_LARGE/i);
      }
    } finally {
      await close();
    }
  });

  it("T-06: processes maximum 50,000-char description under 500ms without ReDoS", async () => {
    const { client, close } = await testClient();
    try {
      // Construct a large 50,000 char JD with repetitive patterns that could trigger ReDoS
      const repetitiveText = (
        "Requirements: 5+ years Java and Docker. Responsibilities: APIs. " + "   \t\r\n".repeat(10)
      ).repeat(500);
      const largeDescription = repetitiveText.slice(0, 49_900);

      const start = performance.now();
      const ingestRes = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...jobInput,
            description: largeDescription,
          },
        },
      });
      const elapsed = performance.now() - start;

      expect(ingestRes.isError).toBe(false);
      expect(elapsed).toBeLessThan(500);

      const jobId = asEnvelope<{ job_id: string }>(ingestRes).data.job_id;

      const extStart = performance.now();
      const extRes = await client.callTool({
        name: "jobs_extract_requirements",
        arguments: { job_id: jobId },
      });
      const extElapsed = performance.now() - extStart;
      expect(extRes.isError).toBe(false);
      expect(extElapsed).toBeLessThan(500);
    } finally {
      await close();
    }
  });

  it("T-07: SQL injection attempts across IDs, queries, filters, and cursors fail safely", async () => {
    const { client, close } = await testClient();
    try {
      // Ingest a legitimate baseline job first
      const ingest = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: jobInput },
      });
      expect(ingest.isError).toBe(false);
      const validJobId = asEnvelope<{ job_id: string }>(ingest).data.job_id;

      // Also create a profile
      const profRes = await client.callTool({
        name: "profile_upsert",
        arguments: { profile: profileInput },
      });
      expect(profRes.isError).toBe(false);
      const validProfileId = asEnvelope<{ profile_id: string }>(profRes).data.profile_id;

      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE jobs; --",
        "'; DELETE FROM profiles; --",
        "' UNION SELECT null, null, null --",
        "admin'--",
        '" OR ""="',
        "1; ATTACH DATABASE ':memory:' AS pwn;",
      ];

      // 1. Injection in jobs_get
      for (const payload of sqlPayloads) {
        const res = await client.callTool({
          name: "jobs_get",
          arguments: { job_id: payload },
        });
        expect(res.isError).toBe(true);
      }

      // 2. Injection in jobs_delete
      for (const payload of sqlPayloads) {
        const res = await client.callTool({
          name: "jobs_delete",
          arguments: { job_id: payload },
        });
        expect(res.isError).toBe(true);
      }

      // 3. Injection in profile_get and profile_delete
      for (const payload of sqlPayloads) {
        const getRes = await client.callTool({
          name: "profile_get",
          arguments: { profile_id: payload },
        });
        expect(getRes.isError).toBe(true);

        const delRes = await client.callTool({
          name: "profile_delete",
          arguments: { profile_id: payload },
        });
        expect(delRes.isError).toBe(true);
      }

      // 4. Injection in jobs_search_local (search query argument)
      for (const payload of sqlPayloads) {
        const res = await client.callTool({
          name: "jobs_search_local",
          arguments: { query: payload },
        });
        // FTS / search with injection string must either return 0 items safely or handle cleanly
        expect(res.isError).toBe(false);
        const data = asEnvelope<{ items: unknown[] }>(res).data;
        expect(Array.isArray(data.items)).toBe(true);
      }

      // 5. Injection in jobs_list cursor
      for (const payload of sqlPayloads) {
        const res = await client.callTool({
          name: "jobs_list",
          arguments: { cursor: payload },
        });
        // Invalid cursor format must error, not execute SQL
        expect(res.isError).toBe(true);
      }

      // 6. Verification: tables still exist and valid items remain intact
      const verifyJob = await client.callTool({
        name: "jobs_get",
        arguments: { job_id: validJobId },
      });
      expect(verifyJob.isError).toBe(false);

      const verifyProfile = await client.callTool({
        name: "profile_get",
        arguments: { profile_id: validProfileId },
      });
      expect(verifyProfile.isError).toBe(false);
    } finally {
      await close();
    }
  });

  it("T-07: static scan verifies store source uses parameterized queries only", () => {
    const storeDir = path.resolve(import.meta.dirname, "../../src/store");
    const files: string[] = [];
    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith(".ts")) files.push(full);
      }
    }
    scan(storeDir);

    for (const file of files) {
      const code = fs.readFileSync(file, "utf-8");
      // Check that prepare calls don't interpolate variables: `SELECT ... ${...}`
      const dangerousInterpolation = /prepare\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/;
      expect(
        code,
        `Found string interpolation in db.prepare() in ${path.basename(file)}`,
      ).not.toMatch(dangerousInterpolation);
    }
  });
});
