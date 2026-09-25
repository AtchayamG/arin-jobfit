import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createJobPortalServer, type ProductConfig } from "../../src/mcp/index.js";
import { openStore } from "../../src/store/index.js";
import type { Policy } from "../../src/policy/index.js";

export const fixedNow = new Date("2026-09-25T12:00:00.000Z");
const capability = (
  id: string,
  level: "L0" | "L1",
  status: "enabled" | "blocked_by_provider_approval",
) => ({
  id,
  level,
  status,
  reason: "Test policy",
  approval_ref: null,
  sources: [],
});

export function testPolicy(analysisEnabled = true): Policy {
  return {
    policy_version: "1",
    product: "naukri-mcp",
    provider: "naukri",
    snapshot_date: "2026-09-25",
    stale_after_days: 30,
    partner_approval_recorded: false,
    capabilities: [
      capability("l0.analysis", "L0", analysisEnabled ? "enabled" : "blocked_by_provider_approval"),
      capability("l0.local_store", "L0", "enabled"),
      capability("l0.agent_relay_ingest", "L0", "enabled"),
      capability("l1.provider_retrieval", "L1", "blocked_by_provider_approval"),
    ],
  };
}

export async function testClient(
  options: { policy?: Policy; logger?: (line: string) => void } = {},
) {
  const store = openStore({ memory: true, product: "naukri-mcp", now: fixedNow.toISOString() });
  const config: ProductConfig = {
    serverName: "naukri-mcp",
    serverVersion: "0.1.0",
    provider: "naukri",
    policy: options.policy ?? testPolicy(),
    hostAllowlist: ["naukri.com"],
    store,
    now: () => fixedNow,
    ...(options.logger ? { logger: options.logger } : {}),
  };
  const server = createJobPortalServer(config);
  const client = new Client({ name: "test-client", version: "0.1.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    store,
    config,
    close: async () => {
      await client.close();
      await server.close();
      store.close();
    },
  };
}

export const jobInput = {
  title: "Senior Java Engineer",
  company: "Acme",
  location: "Pune, India",
  description:
    "Requirements:\n- Must know Java and Docker.\n- AWS is a plus.\nResponsibilities:\n- Build services.",
  source_url: "https://www.naukri.com/job/123",
  origin: "user_paste" as const,
};
export const profileInput = {
  label: "Candidate",
  headline: "Java engineer",
  total_experience_years: 6,
  skills: [
    { name: "Java", years: 6 },
    { name: "Docker", years: 3 },
  ],
  preferences: { locations: ["Pune"], remote_modes: [], employment_types: [], deal_breakers: [] },
};
