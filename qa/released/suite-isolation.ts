import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnMcpServer, withTimeout } from "./client-manager.js";
import { getScenarioJds } from "./scenarios.js";

export async function testCrossProductIsolation(): Promise<{ pass: boolean; details: string }> {
  const dirNk = fs.mkdtempSync(path.join(os.tmpdir(), "qa-isol-nk-"));
  const dirId = fs.mkdtempSync(path.join(os.tmpdir(), "qa-isol-id-"));

  const serverNk = await spawnMcpServer("arin-jobfit-nk@0.1.0", "NAUKRI_MCP_DATA_DIR", dirNk);
  const serverId = await spawnMcpServer("arin-jobfit-id@0.1.0", "INDEED_MCP_DATA_DIR", dirId);

  try {
    const { jd_a } = getScenarioJds("nk");
    const { jd_b } = getScenarioJds("id");

    // Ingest into nk
    const ingNk = await withTimeout(
      serverNk.client.callTool({ name: "jobs_ingest", arguments: { job: jd_a } }),
      15000,
      "ingest into nk",
    );
    const idNk = (ingNk.structuredContent as { data: { job_id: string } }).data.job_id;

    // Ingest into id
    const ingId = await withTimeout(
      serverId.client.callTool({ name: "jobs_ingest", arguments: { job: jd_b } }),
      15000,
      "ingest into id",
    );
    const idId = (ingId.structuredContent as { data: { job_id: string } }).data.job_id;

    // nk list
    const listNk = await withTimeout(
      serverNk.client.callTool({ name: "jobs_list", arguments: {} }),
      15000,
      "list on nk",
    );
    const itemsNk = (listNk.structuredContent as { data: { items: Array<{ job_id: string }> } }).data.items;
    const nkSeesOnlyOwn = itemsNk.some((j) => j.job_id === idNk) && !itemsNk.some((j) => j.job_id === idId);

    // id list
    const listId = await withTimeout(
      serverId.client.callTool({ name: "jobs_list", arguments: {} }),
      15000,
      "list on id",
    );
    const itemsId = (listId.structuredContent as { data: { items: Array<{ job_id: string }> } }).data.items;
    const idSeesOnlyOwn = itemsId.some((j) => j.job_id === idId) && !itemsId.some((j) => j.job_id === idNk);

    // Cross-get rejection
    let crossGetNkFails = false;
    try {
      const res = await withTimeout(
        serverNk.client.callTool({ name: "jobs_get", arguments: { job_id: idId } }),
        15000,
        "cross get on nk",
      );
      crossGetNkFails = res.isError === true;
    } catch {
      crossGetNkFails = true;
    }

    let crossGetIdFails = false;
    try {
      const res = await withTimeout(
        serverId.client.callTool({ name: "jobs_get", arguments: { job_id: idNk } }),
        15000,
        "cross get on id",
      );
      crossGetIdFails = res.isError === true;
    } catch {
      crossGetIdFails = true;
    }

    const pass = nkSeesOnlyOwn && idSeesOnlyOwn && crossGetNkFails && crossGetIdFails;
    return {
      pass,
      details: `NK isolated: ${nkSeesOnlyOwn}, ID isolated: ${idSeesOnlyOwn}, Cross-gets rejected: ${crossGetNkFails && crossGetIdFails}`,
    };
  } finally {
    await serverNk.close();
    await serverId.close();
    fs.rmSync(dirNk, { recursive: true, force: true });
    fs.rmSync(dirId, { recursive: true, force: true });
  }
}
