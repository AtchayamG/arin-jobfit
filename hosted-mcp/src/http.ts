import type { IncomingMessage, ServerResponse } from "node:http";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { policy } from "@jpm/job-core";
import { createHostedMcpServer } from "./server.js";
import {
  getCorsHeaders,
  PayloadTooLargeError,
  readBodyWithLimit,
  TokenBucketRateLimiter,
  validateHostHeader,
} from "./security.js";

type Policy = policy.Policy;

export interface AppOptions {
  policy: Policy;
  version?: string;
  isProduction?: boolean;
  allowedHosts?: string;
  allowedOrigins?: string;
  rateLimiter?: TokenBucketRateLimiter;
}

const PRIVACY_TEXT =
  "Arin JobFit Hosted MCP — Privacy Statement\n\n" +
  "1. No Storage: The server stores nothing. There is no database, no file storage, and no caching of job descriptions or profiles.\n" +
  "2. No Model Training: Incoming data is never used for AI model training or fine-tuning.\n" +
  "3. Request Isolation: Each request is processed entirely in memory in a stateless session and discarded immediately upon completion.\n" +
  "4. Logging: Server logs record only HTTP method, path, response status code, and latency in milliseconds. Request bodies, response bodies, and personal profiles are never logged.\n" +
  "5. Third-party URLs: The server never crawls, scrapes, or fetches job URLs.\n";

const LANDING_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Arin JobFit Hosted MCP</title></head>\n' +
  '<body style="font-family:sans-serif;max-width:700px;margin:40px auto;line-height:1.6;padding:0 20px;">\n' +
  "  <h1>Arin JobFit (Hosted Edition)</h1>\n" +
  "  <p>Stateless Model Context Protocol (MCP) server for job description analysis and fit scoring.</p>\n" +
  "  <p><strong>Guaranteed Stateless:</strong> This server stores nothing. No database, no session files, no user accounts. Job text and profile data arrive with each call and results return immediately.</p>\n" +
  "  <p><strong>Disclaimer:</strong> Independent project; not affiliated with Naukri, Info Edge, or Indeed. Decision support only; not a prediction of hiring outcome. Never performs autonomous applications.</p>\n" +
  '  <p><a href="https://github.com/AtchayamG/arin-jobfit">GitHub Repository</a> | <a href="/privacy">Privacy Statement</a></p>\n' +
  "</body>\n</html>";

function safeLog(entry: { method: string; path: string; status: number; latencyMs: number }): void {
  const line = JSON.stringify(entry);
  process.stdout.write(`${line}\n`);
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

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const start = Date.now();
    const method = req.method?.toUpperCase() ?? "GET";
    const rawUrl = req.url ?? "/";
    const path = rawUrl.split("?")[0] ?? "/";

    req.setTimeout(10_000, () => {
      if (!res.headersSent) {
        sendJson(res, 504, { error: "Request Timeout" });
      }
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
      for (const [k, v] of Object.entries(cors)) {
        res.setHeader(k, v);
      }
    }

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      finish(204);
      return;
    }

    const ip = req.socket.remoteAddress ?? "unknown";
    const rateCheck = rateLimiter.consume(ip);
    if (!rateCheck.allowed) {
      const retryAfter = rateCheck.retryAfterSeconds ?? 1;
      sendJson(res, 429, { error: "Too Many Requests" }, { "Retry-After": String(retryAfter) });
      finish(429);
      return;
    }

    if (path === "/healthz" && method === "GET") {
      sendJson(res, 200, { status: "ok", version });
      finish(200);
      return;
    }

    if (path === "/" && method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(LANDING_HTML);
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
      if (method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        finish(405);
        return;
      }

      let body: Buffer;
      try {
        body = await readBodyWithLimit(req);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendJson(res, 413, { error: "Payload Too Large" });
          finish(413);
          return;
        }
        sendJson(res, 400, { error: "Bad Request" });
        finish(400);
        return;
      }

      try {
        const fullUrl = `http://${hostHeader ?? "localhost"}${rawUrl}`;
        const webReq = new Request(fullUrl, {
          method: "POST",
          headers: req.headers as HeadersInit,
          body: new Uint8Array(body),
        });

        const server = createHostedMcpServer(options.policy, version);
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        await server.connect(transport);
        const webRes = await transport.handleRequest(webReq);

        res.statusCode = webRes.status;
        for (const [k, v] of webRes.headers.entries()) {
          res.setHeader(k, v);
        }

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
        if (!res.headersSent) {
          sendJson(res, 500, { error: "Internal Server Error" });
        }
        finish(500);
      }
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
    finish(404);
  };
}
