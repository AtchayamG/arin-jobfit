import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const distPath = path.resolve(import.meta.dirname, "../../dist/index.js");

describe("T-11: Stdout protocol purity and JSON-RPC stream integrity", () => {
  it("T-11: guarantees 100% of stdout lines are valid JSON-RPC during valid, error, and malformed inputs", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-sec-protocol-"));
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    const child = spawn("node", [distPath], {
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: tempDir,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) stdoutLines.push(trimmed);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrLines.push(chunk.toString("utf-8"));
    });

    const sendRpc = (obj: unknown): void => {
      child.stdin.write(JSON.stringify(obj) + "\n");
    };

    const sendRaw = (raw: string): void => {
      child.stdin.write(raw + "\n");
    };

    try {
      // 1. Send MCP Initialize request
      sendRpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "sec-auditor", version: "1.0.0" },
        },
      });

      // 2. Send initialized notification
      sendRpc({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });

      // 3. Send valid tools/list request
      sendRpc({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      // 4. Send tool error call (invalid job_id)
      sendRpc({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "jobs_get",
          arguments: { job_id: "invalid_id_not_uuid" },
        },
      });

      // 5. Send unknown method
      sendRpc({
        jsonrpc: "2.0",
        id: 4,
        method: "completely/unknown/method",
        params: {},
      });

      // 6. Send malformed non-JSON garbage line
      sendRaw("<<<MALFORMED_NON_JSON_RPC_INPUT>>>");

      // 7. Send truncated JSON
      sendRaw('{"jsonrpc": "2.0", "id": 5, "method": "unclosed_string');

      // Wait a moment for processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Close cleanly
      child.stdin.end();
      await new Promise((resolve) => child.on("exit", resolve));

      // CRITICAL ASSERTION: Every single stdout line must parse as valid JSON
      interface JsonRpcMessage {
        jsonrpc: string;
        id?: number | string | null;
        result?: { isError?: boolean };
        error?: { code: number; message?: string };
      }

      const parseMsg = (line: string): JsonRpcMessage => {
        return JSON.parse(line) as JsonRpcMessage;
      };

      expect(stdoutLines.length).toBeGreaterThan(0);
      for (const line of stdoutLines) {
        expect(() => {
          JSON.parse(line);
        }).not.toThrow();
        const parsed = parseMsg(line);
        expect(parsed).toHaveProperty("jsonrpc", "2.0");
      }

      // Verify response IDs match requests
      const initResp = stdoutLines.find((l) => parseMsg(l).id === 1);
      expect(initResp).toBeDefined();

      const listResp = stdoutLines.find((l) => parseMsg(l).id === 2);
      expect(listResp).toBeDefined();

      const errToolResp = stdoutLines.find((l) => parseMsg(l).id === 3);
      expect(errToolResp).toBeDefined();
      if (errToolResp) {
        const parsedToolErr = parseMsg(errToolResp);
        expect(parsedToolErr.result?.isError).toBe(true);
      }

      const unknownMethodResp = stdoutLines.find((l) => parseMsg(l).id === 4);
      expect(unknownMethodResp).toBeDefined();
      if (unknownMethodResp) {
        expect(parseMsg(unknownMethodResp).error?.code).toBe(-32601);
      }
    } finally {
      child.kill();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
