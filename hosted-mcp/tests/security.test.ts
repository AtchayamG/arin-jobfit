import http, { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policy } from "@jpm/job-core";
import naukriPolicyJson from "../config/naukri-policy.json" with { type: "json" };
import { createRequestHandler } from "../src/http.js";
import { getClientIp, TokenBucketRateLimiter } from "../src/security.js";

const testPolicy = policy.loadPolicy(naukriPolicyJson, new Date("2026-09-25T00:00:00Z"));

describe("Security Tests — Hosted MCP", () => {
  let server: Server;
  let baseUrl: string;
  let rateLimiter: TokenBucketRateLimiter;

  beforeAll(async () => {
    rateLimiter = new TokenBucketRateLimiter(5, 5); // small bucket for testing 429
    const handler = createRequestHandler({
      policy: testPolicy,
      rateLimiter,
      isProduction: true,
      allowedHosts: "allowed.example.com,localhost,127.0.0.1",
      allowedOrigins: "https://trusted-client.com",
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

  it("returns 403 Forbidden when Host header is not in allowlist (DNS rebinding defense)", async () => {
    const port = (server.address() as AddressInfo).port;
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const clientReq = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/healthz",
          method: "GET",
          headers: { Host: "evil-rebinding.com" },
        },
        (clientRes) => {
          let data = "";
          clientRes.on("data", (chunk: Buffer) => {
            data += chunk.toString("utf-8");
          });
          clientRes.on("end", () => {
            resolve({ status: clientRes.statusCode ?? 0, body: data });
          });
        },
      );
      clientReq.on("error", reject);
      clientReq.end();
    });

    expect(res.status).toBe(403);
    const parsed = JSON.parse(res.body) as { error: string };
    expect(parsed.error).toBe("Forbidden Host");
  });

  it("returns 404 with JSON hint for generic /mcp and 405 on GET/DELETE for edition endpoints", async () => {
    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Host: "localhost" },
    });
    expect(mcpRes.status).toBe(404);
    const mcpBody = (await mcpRes.json()) as { error: string; hint: string; editions: unknown };
    expect(mcpBody.error).toBe("not_found");
    expect(mcpBody.hint).toContain("/naukri/mcp");
    expect(mcpBody.editions).toBeDefined();

    const getRes = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "GET",
      headers: { Host: "localhost" },
    });
    expect(getRes.status).toBe(405);
    const getBody = (await getRes.json()) as { error: string };
    expect(getBody.error).toBe("Method Not Allowed");

    const deleteRes = await fetch(`${baseUrl}/indeed/mcp`, {
      method: "DELETE",
      headers: { Host: "localhost" },
    });
    expect(deleteRes.status).toBe(405);
  });

  it("returns 404 JSON for auth-less discovery routes (Claude.ai compatibility)", async () => {
    const discoveryPaths = [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/naukri/mcp",
      "/.well-known/oauth-authorization-server",
      "/.well-known/openid-configuration",
      "/register",
    ];

    for (const p of discoveryPaths) {
      const res = await fetch(`${baseUrl}${p}`, {
        method: p === "/register" ? "POST" : "GET",
        headers: { Host: "localhost" },
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("not_found");
    }
  });

  it("returns 413 Payload Too Large when request body exceeds 64 KB", async () => {
    const hugeBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "jd_analyze", arguments: { job: { description: "x".repeat(70_000) } } },
      id: 1,
    });
    const res = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "POST",
      headers: {
        Host: "localhost",
        "Content-Type": "application/json",
      },
      body: hugeBody,
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Payload Too Large");
  });

  it("rate limits only POST /*/mcp and never unmetered routes like health, discovery, or options", async () => {
    rateLimiter.reset();

    // 5 allowed requests to /naukri/mcp
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/naukri/mcp`, {
        method: "POST",
        headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: i }),
      });
    }

    // 6th POST to /naukri/mcp hits 429
    const rateLimitedRes = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "POST",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 99 }),
    });
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get("retry-after")).toBeDefined();
    const body = (await rateLimitedRes.json()) as { error: string };
    expect(body.error).toBe("Too Many Requests");

    // Unmetered routes still succeed (not rate limited)
    const healthRes = await fetch(`${baseUrl}/healthz`, { headers: { Host: "localhost" } });
    expect(healthRes.status).toBe(200);

    const discRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`, {
      headers: { Host: "localhost" },
    });
    expect(discRes.status).toBe(404);

    const optRes = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "OPTIONS",
      headers: { Host: "localhost" },
    });
    expect(optRes.status).toBe(204);

    rateLimiter.reset();
  });

  it("handles CORS: allows claude.ai, chatgpt.com by default, plus allowed origins, without credentials", async () => {
    const unallowedRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://untrusted.com" },
    });
    expect(unallowedRes.headers.get("access-control-allow-origin")).toBeNull();

    const claudeRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://claude.ai" },
    });
    expect(claudeRes.headers.get("access-control-allow-origin")).toBe("https://claude.ai");

    const chatgptRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://chatgpt.com" },
    });
    expect(chatgptRes.headers.get("access-control-allow-origin")).toBe("https://chatgpt.com");

    const allowedRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://trusted-client.com" },
    });
    expect(allowedRes.headers.get("access-control-allow-origin")).toBe(
      "https://trusted-client.com",
    );

    const optionsRes = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "OPTIONS",
      headers: { Host: "localhost", Origin: "https://claude.ai" },
    });
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("access-control-allow-origin")).toBe("https://claude.ai");
  });

  it("extracts client IP accurately across trustProxy modes (R-15)", () => {
    const fakeSocket = { remoteAddress: "127.0.0.1" };

    const reqWithoutTrust = {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqWithoutTrust, false)).toBe("127.0.0.1");

    const reqWithTrust = {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqWithTrust, true)).toBe("203.0.113.195");
  });
});
