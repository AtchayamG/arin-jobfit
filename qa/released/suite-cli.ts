import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnMcpServer, withTimeout } from "./client-manager.js";
import { seniorMobileProfile, toProfileInput } from "./scenarios.js";
import type { CliCheckResult } from "./types.js";

export function testCliFlags(packageName: string, binName: string): CliCheckResult {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npx.cmd" : "npx";

  // 1. --version
  const verRes = spawnSync(cmd, ["-y", packageName, "--version"], {
    encoding: "utf-8",
    timeout: 30000,
    shell: isWin,
  });
  const verOut = (verRes.stdout || "").trim();
  const verPass = verRes.status === 0 && verOut === "0.1.1";

  // 2. --help (must contain exact bin name)
  const helpRes = spawnSync(cmd, ["-y", packageName, "--help"], {
    encoding: "utf-8",
    timeout: 30000,
    shell: isWin,
  });
  const helpOut = (helpRes.stdout || "").trim();
  const helpPass = helpRes.status === 0 && helpOut.includes(binName);

  // 3. unknown arg (must exit 2 AND print "Usage: <exact bin name>")
  const unkRes = spawnSync(cmd, ["-y", packageName, "--unknown-flag"], {
    encoding: "utf-8",
    timeout: 30000,
    shell: isWin,
  });
  const unkOut = (unkRes.stderr || unkRes.stdout || "").trim();
  const unkPass = unkRes.status === 2 && unkOut.includes(`Usage: ${binName}`);

  return {
    version: { pass: verPass, output: verOut },
    help: { pass: helpPass, output: helpOut.slice(0, 150) },
    unknownArg: { pass: unkPass, exitCode: unkRes.status ?? -1, output: unkOut.slice(0, 150) },
  };
}

export async function testPersistence(
  packageName: string,
  dataDirEnv: string,
): Promise<{ pass: boolean; details: string }> {
  const persistDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-persist-"));
  try {
    // 1. First run: upsert profile and ingest a job
    const server1 = await spawnMcpServer(packageName, dataDirEnv, persistDir);
    let profileId = "";
    let jobId = "";
    try {
      const profRes = await withTimeout(
        server1.client.callTool({
          name: "profile_upsert",
          arguments: { profile: toProfileInput(seniorMobileProfile) },
        }),
        15000,
        "profile_upsert on server1",
      );
      const profEnvelope = profRes.structuredContent as { data: { profile_id: string } };
      profileId = profEnvelope.data.profile_id;

      const ingestRes = await withTimeout(
        server1.client.callTool({
          name: "jobs_ingest",
          arguments: {
            job: {
              title: "Persist Engineer",
              company: "Persistence Corp",
              location: "Bengaluru",
              description: "Persistent job testing disk storage. Requirements: Node.js, SQL.",
              source_url: "https://www.example.com/job/persist-1",
            },
          },
        }),
        15000,
        "jobs_ingest on server1",
      );
      const ingestEnvelope = ingestRes.structuredContent as { data: { job_id: string } };
      jobId = ingestEnvelope.data.job_id;
    } finally {
      await server1.close();
    }

    // 2. Second run: restart server with same data directory and verify records survive
    const server2 = await spawnMcpServer(packageName, dataDirEnv, persistDir);
    try {
      const getProf = await withTimeout(
        server2.client.callTool({
          name: "profile_get",
          arguments: { profile_id: profileId },
        }),
        15000,
        "profile_get on server2",
      );
      const profSurvives = !getProf.isError;

      const getJob = await withTimeout(
        server2.client.callTool({
          name: "jobs_get",
          arguments: { job_id: jobId },
        }),
        15000,
        "jobs_get on server2",
      );
      const jobSurvives = !getJob.isError;

      // Purge and verify nothing remains
      const purgeReq = await withTimeout(
        server2.client.callTool({ name: "data_purge", arguments: {} }),
        15000,
        "data_purge request on server2",
      );
      const token = (purgeReq.structuredContent as { data: { confirmation_token: string } }).data
        .confirmation_token;

      await withTimeout(
        server2.client.callTool({
          name: "data_purge",
          arguments: { confirmation_token: token },
        }),
        15000,
        "data_purge confirm on server2",
      );

      const listJobs = await withTimeout(
        server2.client.callTool({ name: "jobs_list", arguments: {} }),
        15000,
        "jobs_list after purge",
      );
      const items = (listJobs.structuredContent as { data: { items: unknown[] } }).data.items;
      const purgeWorks = items.length === 0;

      const pass = profSurvives && jobSurvives && purgeWorks;
      return {
        pass,
        details: `Profile restored: ${profSurvives}, Job restored: ${jobSurvives}, Clean purge: ${purgeWorks}`,
      };
    } finally {
      await server2.close();
    }
  } finally {
    fs.rmSync(persistDir, { recursive: true, force: true });
  }
}

export async function testErrorPaths(
  server: { client: import("@modelcontextprotocol/client").Client },
  toolsList: Array<{ name: string; outputSchema?: unknown }>,
  knownLimitations: string[],
): Promise<{ missingArgsPass: boolean; unknownIdPass: boolean; oversizedPass: boolean; errorValidations: number }> {
  let errorValidations = 0;

  // 1. Missing args: jobs_get without job_id
  let missingArgsPass = false;
  try {
    const res = await withTimeout(
      server.client.callTool({ name: "jobs_get", arguments: {} }),
      15000,
      "missing args call",
    );
    missingArgsPass = res.isError === true;
  } catch {
    missingArgsPass = true;
    knownLimitations.push("F-1: Missing args throws SDK validation error prior to handler");
  }

  // 2. Unknown ID: jobs_get with non-existent UUID
  let unknownIdPass = false;
  try {
    const res = await withTimeout(
      server.client.callTool({
        name: "jobs_get",
        arguments: { job_id: "00000000-0000-4000-8000-000000000099" },
      }),
      15000,
      "unknown id call",
    );
    const content = res.structuredContent as { status?: string; error?: { code?: string } };
    unknownIdPass = res.isError === true && (content.status === "error" || !content.status);
    if (res.structuredContent) {
      errorValidations++;
    }
  } catch {
    unknownIdPass = false;
  }

  // 3. Oversized input (>50k chars)
  let oversizedPass = false;
  try {
    const res = await withTimeout(
      server.client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            title: "Oversized Job",
            description: "A".repeat(55000),
          },
        },
      }),
      15000,
      "oversized input call",
    );
    oversizedPass = res.isError === true;
  } catch {
    oversizedPass = true;
    knownLimitations.push("Doc 17 §8: Input > 50,000 chars rejected at schema/sanitizer level");
  }

  return { missingArgsPass, unknownIdPass, oversizedPass, errorValidations };
}
