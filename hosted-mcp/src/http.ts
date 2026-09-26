import type { IncomingMessage, ServerResponse } from "node:http";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { policy } from "@jpm/job-core";
import { createHostedEditionServer } from "./server.js";
import {
  getCorsHeaders,
  getClientIp,
  PayloadTooLargeError,
  readBodyWithLimit,
  TokenBucketRateLimiter,
  validateHostHeader,
} from "./security.js";

type Policy = policy.Policy;

export interface AppOptions {
  policy?: Policy;
  naukriPolicy?: Policy;
  indeedPolicy?: Policy;
  version?: string;
  isProduction?: boolean;
  allowedHosts?: string;
  allowedOrigins?: string;
  rateLimiter?: TokenBucketRateLimiter;
  trustProxy?: boolean;
}

const PRIVACY_TEXT =
  "Arin JobFit Hosted MCP — Privacy Statement\n\n" +
  "1. No Storage: The server stores nothing. There is no database, no file storage, and no caching of job descriptions or profiles.\n" +
  "2. No Model Training: Incoming data is never used for AI model training or fine-tuning.\n" +
  "3. Request Isolation: Each request is processed entirely in memory in a stateless session and discarded immediately upon completion.\n" +
  "4. Logging: Server logs record only HTTP method, path, response status code, and latency in milliseconds. Request bodies, response bodies, and personal profiles are never logged.\n" +
  "5. Third-party URLs: The server never crawls, scrapes, or fetches job URLs.\n";

function buildLandingHtml(host: string, proto: string): string {
  const base = `${proto}://${host}`;
  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Arin JobFit Hosted MCP</title></head>\n' +
    '<body style="font-family:sans-serif;max-width:700px;margin:40px auto;line-height:1.6;padding:0 20px;">\n' +
    "  <h1>Arin JobFit (Hosted Editions)</h1>\n" +
    "  <p>Stateless Model Context Protocol (MCP) server for job description analysis and fit scoring.</p>\n" +
    "  <h2>Connector URLs</h2>\n" +
    "  <ul>\n" +
    `    <li><strong>Naukri Edition:</strong> <code>${base}/naukri/mcp</code> — Independent analysis for Naukri postings (L0 only)</li>\n` +
    `    <li><strong>Indeed Edition:</strong> <code>${base}/indeed/mcp</code> — Independent analysis for Indeed postings (L0 only)</li>\n` +
    "  </ul>\n" +
    "  <p><strong>Guaranteed Stateless:</strong> Stores nothing. No database, no user accounts. Job text and profile arrive with each call.</p>\n" +
    "  <p><strong>Disclaimer:</strong> Independent project; not affiliated with Naukri, Info Edge, or Indeed. Never performs autonomous applications.</p>\n" +
    '  <p><a href="https://github.com/AtchayamG/arin-jobfit">GitHub Repository</a> | <a href="/privacy">Privacy Statement</a></p>\n' +
    "</body>\n</html>"
  );
}

function safeLog(entry: { method: string; path: string; status: number; latencyMs: number }): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): void {
  res.writeHead(status, { "Content-Type": "application/json", ...(headers ?? {}) });
  res.end(JSON.stringify(body));
}

export function createRequestHandler(options: AppOptions) {
  const rateLimiter = options.rateLimiter ?? new TokenBucketRateLimiter(30, 30);
  const version = options.version ?? "0.1.0";
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const allowedHosts = options.allowedHosts ?? process.env.ALLOWED_HOSTS;
  const allowedOrigins = options.allowedOrigins ?? process.env.ALLOWED_ORIGINS;
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "1";
  const naukriPol = options.naukriPolicy ?? options.policy;
  const indeedPol = options.indeedPolicy ?? options.policy;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const start = Date.now();
    const method = req.method?.toUpperCase() ?? "GET";
    const rawUrl = req.url ?? "/";
    const path = rawUrl.split("?")[0] ?? "/";

    req.setTimeout(10_000, () => {
      if (!res.headersSent) sendJson(res, 504, { error: "Request Timeout" });
      req.destroy();
    });

    const finish = (status: number): void => {
      safeLog({ method, path, status, latencyMs: Date.now() - start });
    };

    const hostHeader = req.headers.host;
    if (!validateHostHeader(hostHeader, allowedHosts, isProduction)) {
      sendJson(res, 403, { error: "Forbidden Host" });
      finish(403);
      return;
    }

    const cors = getCorsHeaders(req.headers.origin, allowedOrigins);
    if (cors) {
      for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
    }

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      finish(204);
      return;
    }

    if (
      path.startsWith("/.well-known/oauth-protected-resource") ||
      path === "/.well-known/oauth-authorization-server" ||
      path === "/.well-known/openid-configuration" ||
      path === "/register"
    ) {
      sendJson(res, 404, { error: "not_found" });
      finish(404);
      return;
    }

    if ((path === "/healthz" || path === "/health") && method === "GET") {
      sendJson(res, 200, { status: "ok", version });
      finish(200);
      return;
    }

    if (path === "/" && method === "GET") {
      const proto =
        (req.headers["x-forwarded-proto"] as string) || (isProduction ? "https" : "http");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildLandingHtml(hostHeader ?? "localhost", proto));
      finish(200);
      return;
    }

    if (path === "/privacy" && method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(PRIVACY_TEXT);
      finish(200);
      return;
    }

    if (path === "/mcp") {
      sendJson(res, 404, {
        error: "not_found",
        hint: "Use /naukri/mcp for Naukri edition or /indeed/mcp for Indeed edition.",
        editions: { naukri: "/naukri/mcp", indeed: "/indeed/mcp" },
      });
      finish(404);
      return;
    }

    if (path === "/naukri/mcp" || path === "/indeed/mcp") {
      if (method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        finish(405);
        return;
      }

      const ip = getClientIp(req, trustProxy);
      const rateCheck = rateLimiter.consume(ip);
      if (!rateCheck.allowed) {
        const retryAfter = rateCheck.retryAfterSeconds ?? 1;
        sendJson(res, 429, { error: "Too Many Requests" }, { "Retry-After": String(retryAfter) });
        finish(429);
        return;
      }

      let body: Buffer;
      try {
        body = await readBodyWithLimit(req);
      } catch (err) {
        const status = err instanceof PayloadTooLargeError ? 413 : 400;
        sendJson(res, status, { error: status === 413 ? "Payload Too Large" : "Bad Request" });
        finish(status);
        return;
      }

      try {
        const fullUrl = `http://${hostHeader ?? "localhost"}${rawUrl}`;
        const headers = new Headers(req.headers as HeadersInit);
        const currentAccept = headers.get("accept") ?? "";
        if (!currentAccept.includes("text/event-stream")) {
          headers.set(
            "accept",
            currentAccept
              ? `${currentAccept}, text/event-stream`
              : "application/json, text/event-stream",
          );
        }
        const updatedAccept = headers.get("accept") ?? "";
        if (!updatedAccept.includes("application/json")) {
          headers.set("accept", `${updatedAccept}, application/json`);
        }

        const webReq = new Request(fullUrl, {
          method: "POST",
          headers,
          body: new Uint8Array(body),
        });

        const isIndeed = path.startsWith("/indeed");
        const activePolicy = isIndeed ? indeedPol : naukriPol;
        if (!activePolicy) {
          sendJson(res, 500, { error: "Policy Not Configured" });
          finish(500);
          return;
        }
        const server = createHostedEditionServer(
          isIndeed ? "indeed" : "naukri",
          activePolicy,
          version,
        );
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        await server.connect(transport);
        const webRes = await transport.handleRequest(webReq);

        res.statusCode = webRes.status;
        for (const [k, v] of webRes.headers.entries()) res.setHeader(k, v);

        if (webRes.body) {
          const ab = await webRes.arrayBuffer();
          res.end(Buffer.from(ab));
        } else {
          res.end();
        }

        await transport.close().catch(() => {});
        await server.close().catch(() => {});
        finish(webRes.status);
      } catch {
        if (!res.headersSent) sendJson(res, 500, { error: "Internal Server Error" });
        finish(500);
      }
      return;
    }

    sendJson(res, 404, { error: "not_found" });
    finish(404);
  };
}
