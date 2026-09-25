import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "../../src/policy/index.js";
import { validateSourceUrl } from "../../src/sanitize/url.js";
import { testClient, testPolicy, jobInput } from "../mcp/client.js";
import { asEnvelope } from "./helpers.js";

describe("T-03, T-04, T-05: Policy gate tampering, zero network elevation, and SSRF prevention", () => {
  it("T-03: policy engine fails closed on tampering or unauthorized L1 capabilities", () => {
    const corruptedPolicy = {
      ...testPolicy(),
      partner_approval_recorded: false,
      capabilities: [
        {
          id: "l1.provider_retrieval",
          level: "L1" as const,
          status: "enabled" as const, // TAMPERED: L1 enabled without partner approval
          reason: "Unauthorized elevation attempt",
          approval_ref: null,
          sources: [],
        },
      ],
    };

    const decision = evaluate(corruptedPolicy, "l1.provider_retrieval", new Date("2026-09-25"));
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("BLOCKED_BY_PROVIDER_APPROVAL");
  });

  it("T-04: static import scan proves zero network/HTTP modules in shared/job-core/src", () => {
    const srcDir = path.resolve(import.meta.dirname, "../../src");
    const forbiddenModules = [
      "http",
      "https",
      "node:http",
      "node:https",
      "net",
      "node:net",
      "tls",
      "node:tls",
      "dgram",
      "node:dgram",
      "undici",
      "axios",
      "got",
    ];

    const files: string[] = [];
    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith(".ts")) files.push(full);
      }
    }
    scan(srcDir);

    for (const file of files) {
      const code = fs.readFileSync(file, "utf-8");
      for (const mod of forbiddenModules) {
        const importRegex = new RegExp(`from\\s+['"]${mod}['"]`, "i");
        expect(code, `Found forbidden network import '${mod}' in ${file}`).not.toMatch(importRegex);
      }
    }
  });

  it("T-04: runtime network kill-switch confirms zero network activity during tool pipeline", async () => {
    // Monkey-patch network APIs to throw immediately
    const origFetch = globalThis.fetch;
    const origConnectDesc = Object.getOwnPropertyDescriptor(net.Socket.prototype, "connect");

    globalThis.fetch = () => {
      throw new Error("SECURITY_ALERT: fetch() called in local safe mode");
    };
    net.Socket.prototype.connect = function (this: unknown) {
      throw new Error("SECURITY_ALERT: net.Socket.connect() called in local safe mode");
    };

    try {
      const { client, close } = await testClient();
      try {
        const ingest = await client.callTool({
          name: "jobs_ingest",
          arguments: { job: jobInput },
        });
        expect(ingest.isError).toBe(false);
        const jobId = asEnvelope<{ job_id: string }>(ingest).data.job_id;

        const norm = await client.callTool({
          name: "jobs_normalize",
          arguments: { job: jobInput },
        });
        expect(norm.isError).toBe(false);

        const handoff = await client.callTool({
          name: "jobs_application_handoff",
          arguments: { job_id: jobId },
        });
        expect(handoff.isError).toBe(false);
      } finally {
        await close();
      }
    } finally {
      globalThis.fetch = origFetch;
      if (origConnectDesc) {
        Object.defineProperty(net.Socket.prototype, "connect", origConnectDesc);
      }
    }
  });

  it("T-05: rejects or flags SSRF URL vectors (IP literals, localhost, userinfo, ports, schemes)", async () => {
    const dangerousUrls = [
      "http://127.0.0.1/job",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/job",
      "https://localhost:8080/job",
      "https://user:password@naukri.com/job/123",
      "https://naukri.com:8443/job/123",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,malicious",
      "https://attacker-fake-naukri.com/job/123",
    ];

    const hostAllowlist = ["naukri.com"];

    for (const url of dangerousUrls) {
      const result = validateSourceUrl(url, hostAllowlist);
      if (result.ok) {
        expect(result.isOfficial, `URL ${url} must not be considered official`).toBe(false);
      } else {
        expect(result.code).toBe("UNSAFE_URL");
      }
    }

    // Through the MCP ingest tool
    const { client, close } = await testClient();
    try {
      const ssrfRes = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...jobInput,
            source_url: "http://169.254.169.254/metadata",
          },
        },
      });
      expect(ssrfRes.isError).toBe(true);
      const content = ssrfRes.structuredContent as {
        status: string;
        error?: { code: string };
      };
      expect(content.status).toBe("error");
      expect(content.error?.code).toBe("UNSAFE_URL");
    } finally {
      await close();
    }
  });
});
