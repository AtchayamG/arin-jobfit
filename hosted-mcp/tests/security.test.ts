import http, { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { policy } from "@jpm/job-core";
import policyJson from "../config/policy.json" with { type: "json" };
import { createRequestHandler } from "../src/http.js";
import { getClientIp, TokenBucketRateLimiter } from "../src/security.js";

const testPolicy = policy.loadPolicy(policyJson, new Date("2026-09-25T00:00:00Z"));

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

  it("returns 405 Method Not Allowed for GET or DELETE on /mcp", async () => {
    const getRes = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { Host: "localhost" },
    });
    expect(getRes.status).toBe(405);
    const getBody = (await getRes.json()) as { error: string };
    expect(getBody.error).toBe("Method Not Allowed");

    const deleteRes = await fetch(`${baseUrl}/mcp`, {
      method: "DELETE",
      headers: { Host: "localhost" },
    });
    expect(deleteRes.status).toBe(405);
  });

  it("returns 413 Payload Too Large when request body exceeds 64 KB", async () => {
    const hugeBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "jd_analyze", arguments: { job: { description: "x".repeat(70_000) } } },
      id: 1,
    });
    const res = await fetch(`${baseUrl}/mcp`, {
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

  it("returns 429 Too Many Requests with Retry-After when rate limit is exceeded", async () => {
    // Consume remaining tokens
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/healthz`, { headers: { Host: "localhost" } });
    }
    const rateLimitedRes = await fetch(`${baseUrl}/healthz`, { headers: { Host: "localhost" } });
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get("retry-after")).toBeDefined();
    const body = (await rateLimitedRes.json()) as { error: string };
    expect(body.error).toBe("Too Many Requests");

    rateLimiter.reset(); // reset for other tests
  });

  it("handles CORS strictly: sets header only for allowed origins, never wildcard", async () => {
    const unallowedRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://untrusted.com" },
    });
    expect(unallowedRes.headers.get("access-control-allow-origin")).toBeNull();

    const allowedRes = await fetch(`${baseUrl}/healthz`, {
      headers: { Host: "localhost", Origin: "https://trusted-client.com" },
    });
    expect(allowedRes.headers.get("access-control-allow-origin")).toBe(
      "https://trusted-client.com",
    );

    const optionsRes = await fetch(`${baseUrl}/mcp`, {
      method: "OPTIONS",
      headers: { Host: "localhost", Origin: "https://trusted-client.com" },
    });
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("access-control-allow-origin")).toBe(
      "https://trusted-client.com",
    );
  });

  it("extracts client IP accurately across trustProxy modes (R-15)", () => {
    const fakeSocket = { remoteAddress: "127.0.0.1" };

    // Mode 1: trustProxy = false (default) — spoofed header ignored
    const reqWithoutTrust = {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqWithoutTrust, false)).toBe("127.0.0.1");

    // Mode 2: trustProxy = true — first IP in X-Forwarded-For used
    const reqWithTrust = {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqWithTrust, true)).toBe("203.0.113.195");

    // Mode 2 edge cases: array header or missing header
    const reqArrayHeader = {
      headers: { "x-forwarded-for": ["198.51.100.1, 10.0.0.1"] },
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqArrayHeader, true)).toBe("198.51.100.1");

    const reqMissingHeader = {
      headers: {},
      socket: fakeSocket,
    } as unknown as http.IncomingMessage;
    expect(getClientIp(reqMissingHeader, true)).toBe("127.0.0.1");
  });

  it("enforces separate rate limit buckets when TRUST_PROXY is enabled", async () => {
    const customLimiter = new TokenBucketRateLimiter(2, 2);
    const proxyHandler = createRequestHandler({
      policy: testPolicy,
      rateLimiter: customLimiter,
      trustProxy: true,
      allowedHosts: "localhost,127.0.0.1",
    });
    const proxyServer = createServer((req, res) => {
      void proxyHandler(req, res);
    });
    await new Promise<void>((resolve) => {
      proxyServer.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const port = (proxyServer.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${String(port)}`;

    try {
      // IP A uses up its 2 tokens
      await fetch(`${url}/healthz`, {
        headers: { Host: "localhost", "X-Forwarded-For": "100.0.0.1" },
      });
      await fetch(`${url}/healthz`, {
        headers: { Host: "localhost", "X-Forwarded-For": "100.0.0.1" },
      });
      const resA = await fetch(`${url}/healthz`, {
        headers: { Host: "localhost", "X-Forwarded-For": "100.0.0.1" },
      });
      expect(resA.status).toBe(429);

      // IP B still has tokens available despite IP A being rate limited
      const resB = await fetch(`${url}/healthz`, {
        headers: { Host: "localhost", "X-Forwarded-For": "200.0.0.1" },
      });
      expect(resB.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => {
        proxyServer.close(() => {
          resolve();
        });
      });
    }
  });
});
