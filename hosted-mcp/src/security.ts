import type { IncomingMessage } from "node:http";

export const MAX_BODY_BYTES = 64 * 1024; // 64 KB

export class PayloadTooLargeError extends Error {
  constructor(message = "Payload Too Large") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private lastCleanup = Date.now();

  constructor(capacity = 30, refillPerMinute = 30) {
    this.capacity = capacity;
    this.refillPerMs = refillPerMinute / 60_000;
  }

  public consume(ip: string, now = Date.now()): RateLimitResult {
    this.cleanupIfDue(now);

    const bucket = this.buckets.get(ip) ?? { tokens: this.capacity, lastRefill: now };
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const refreshedTokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);

    if (refreshedTokens >= 1) {
      this.buckets.set(ip, { tokens: refreshedTokens - 1, lastRefill: now });
      return { allowed: true };
    }

    const deficit = 1 - refreshedTokens;
    const waitMs = deficit / this.refillPerMs;
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    this.buckets.set(ip, { tokens: refreshedTokens, lastRefill: now });
    return { allowed: false, retryAfterSeconds };
  }

  private cleanupIfDue(now: number): void {
    if (now - this.lastCleanup < 300_000) return;
    this.lastCleanup = now;
    const maxAge = 600_000;
    for (const [ip, b] of this.buckets.entries()) {
      if (now - b.lastRefill > maxAge) {
        this.buckets.delete(ip);
      }
    }
  }

  public reset(): void {
    this.buckets.clear();
  }
}

export function validateHostHeader(
  hostHeader: string | undefined,
  allowedHostsEnv: string | undefined,
  isProduction: boolean,
): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(":")[0]?.toLowerCase().trim() ?? "";
  if (!hostname) return false;

  if (!isProduction) {
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return true;
    }
  }

  if (!allowedHostsEnv) return !isProduction;

  const allowed = allowedHostsEnv
    .split(",")
    .map((h) => h.toLowerCase().trim())
    .filter((h) => h.length > 0);

  return allowed.includes(hostname);
}

export function getCorsHeaders(
  originHeader: string | undefined,
  allowedOriginsEnv: string | undefined,
): Record<string, string> | null {
  if (!allowedOriginsEnv || !originHeader) return null;
  const allowed = allowedOriginsEnv
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (allowed.includes(originHeader)) {
    return {
      "Access-Control-Allow-Origin": originHeader,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Authorization",
    };
  }
  return null;
}

export function readBodyWithLimit(
  req: IncomingMessage,
  maxBytes = MAX_BODY_BYTES,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
    const contentLength = headers?.["content-length"];
    if (
      contentLength &&
      parseInt(Array.isArray(contentLength) ? (contentLength[0] ?? "0") : contentLength, 10) >
        maxBytes
    ) {
      reject(new PayloadTooLargeError());
      return;
    }

    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    const onData = (chunk: Buffer): void => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = (): void => {
      resolve(Buffer.concat(chunks));
    };

    const onError = (err: Error): void => {
      reject(err);
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

export function getClientIp(req: IncomingMessage, trustProxy = false): string {
  if (trustProxy) {
    const header = req.headers["x-forwarded-for"];
    if (typeof header === "string") {
      const first = header.split(",")[0]?.trim();
      if (first) return first;
    } else if (Array.isArray(header) && header.length > 0 && header[0]) {
      const first = header[0].split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}
