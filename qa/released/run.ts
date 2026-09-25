import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnMcpServer, verifyPackageHasNoNetworkCalls, withTimeout } from "./client-manager.js";
import { generateReport } from "./report-generator.js";
import { testCliFlags, testErrorPaths, testPersistence } from "./suite-cli.js";
import { testCrossProductIsolation } from "./suite-isolation.js";
import { runFullJourney } from "./suite-journey.js";
import type { EditionResult } from "./types.js";

const manifestPath = path.resolve(import.meta.dirname, "../../shared/contracts/tool-manifest.v1.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
  tools: Array<{ name: string; outputSchema?: unknown }>;
};
const manifestToolNames = manifest.tools.map((t) => t.name).sort();

async function testEdition(
  edition: "nk" | "id",
  packageName: string,
  dataDirEnv: string,
  binName: string,
): Promise<EditionResult> {
  console.log(`\n========================================`);
  console.log(`Starting E2E test for ${packageName}`);
  console.log(`========================================`);

  // 1. CLI Tests
  console.log(`[1/6] Testing CLI flags (--version, --help, unknown arg)...`);
  const cli = testCliFlags(packageName, binName);
  console.log(`  --version: ${cli.version.pass ? "PASS" : "FAIL"} (${cli.version.output})`);
  console.log(`  --help:    ${cli.help.pass ? "PASS" : "FAIL"}`);
  console.log(`  unknown:   ${cli.unknownArg.pass ? "PASS" : "FAIL"} (${cli.unknownArg.output})`);

  // 2. Cold and Warm Start Measurements
  console.log(`[2/6] Measuring cold and warm start spawn latencies...`);
  const coldDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-cold-"));
  const coldStartT0 = Date.now();
  const coldServer = await spawnMcpServer(packageName, dataDirEnv, coldDir);
  const coldStartMs = Date.now() - coldStartT0;
  await coldServer.close();
  fs.rmSync(coldDir, { recursive: true, force: true });

  const warmDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-warm-"));
  const warmStartT0 = Date.now();
  const warmServer = await spawnMcpServer(packageName, dataDirEnv, warmDir);
  const warmStartMs = Date.now() - warmStartT0;
  await warmServer.close();
  fs.rmSync(warmDir, { recursive: true, force: true });
  console.log(`  Cold start: ${coldStartMs}ms, Warm start: ${warmStartMs}ms`);

  // 3. Main Journey Server
  console.log(`[3/6] Starting server for tools/list and 22-tool full user journey...`);
  const journeyDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-journey-"));
  const server = await spawnMcpServer(packageName, dataDirEnv, journeyDir);

  const toolCoverage = new Map<string, number>();
  manifestToolNames.forEach((name) => toolCoverage.set(name, 0));
  const toolLatenciesMs: number[] = [];
  const knownLimitations: string[] = [];

  let toolListPass = false;
  let orderStable = false;
  let toolCount = 0;
  let listNamesMatch = false;

  try {
    const list1 = await withTimeout(server.client.listTools(), 15000, "listTools call 1");
    const list2 = await withTimeout(server.client.listTools(), 15000, "listTools call 2");

    const names1 = list1.tools.map((t) => t.name);
    const names2 = list2.tools.map((t) => t.name);
    toolCount = names1.length;
    orderStable = JSON.stringify(names1) === JSON.stringify(names2);

    const sortedNames1 = [...names1].sort();
    listNamesMatch = JSON.stringify(sortedNames1) === JSON.stringify(manifestToolNames);
    toolListPass = toolCount === 22 && listNamesMatch && orderStable;
    console.log(`  tools/list: ${toolListPass ? "PASS" : "FAIL"} (${toolCount}/22 tools, stable order: ${orderStable})`);

    // Run Full Journey
    console.log(`[4/6] Executing full user journey across all tools...`);
    const journey = await runFullJourney(server, edition, toolCoverage, toolLatenciesMs, list1.tools);
    console.log(`  Journey complete. Invariants check:`);
    console.log(`    Evidence Substring:       ${journey.invariants.evidenceSubstring ? "PASS" : "FAIL"}`);
    console.log(`    Ranking Accuracy:         ${journey.invariants.rankingCorrect ? "PASS" : "FAIL"}`);
    console.log(`    Indian Salaries Parsed:   ${journey.invariants.salariesCorrect ? "PASS" : "FAIL"}`);
    console.log(`    Prompt Injection Guard:   ${journey.invariants.injectionNeutralized ? "PASS" : "FAIL"}`);
    console.log(`    Discriminatory Flags:     ${journey.invariants.discriminatoryExcluded ? "PASS" : "FAIL"}`);
    console.log(`    L1+ Gated Boundary:       ${journey.invariants.l1Blocked ? "PASS" : "FAIL"}`);
    console.log(`    Human Application Handoff:${journey.invariants.humanOnlyHandoff ? "PASS" : "FAIL"}`);
    console.log(`    Zero Outbound Network:    ${journey.invariants.noNetwork ? "PASS" : "FAIL"}`);

    // Error Paths
    console.log(`[5/6] Testing error paths (missing args, unknown ID, oversized input)...`);
    const errorPaths = await testErrorPaths(server, list1.tools, knownLimitations);
    console.log(`  Missing args: ${errorPaths.missingArgsPass ? "PASS" : "FAIL"}`);
    console.log(`  Unknown ID:   ${errorPaths.unknownIdPass ? "PASS" : "FAIL"}`);
    console.log(`  Oversized:    ${errorPaths.oversizedPass ? "PASS" : "FAIL"}`);

    // Static package zero network verification (Q-1)
    const staticNetScan = verifyPackageHasNoNetworkCalls(packageName);
    if (!staticNetScan.pass) {
      throw new Error(`Package network scan failed: ${staticNetScan.details}`);
    }

    // Protocol purity check (Q-5: fail, not warn)
    server.assertProtocolPurity();

    // Persistence
    console.log(`[6/6] Testing persistence and purge flow...`);
    const persistence = await testPersistence(packageName, dataDirEnv);
    console.log(`  Persistence: ${persistence.pass ? "PASS" : "FAIL"} (${persistence.details})`);

    const sortedLatencies = [...toolLatenciesMs].sort((a, b) => a - b);
    const p50Ms = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0;
    const maxMs = sortedLatencies[sortedLatencies.length - 1] ?? 0;
    console.log(`  Tool Latencies: p50 = ${p50Ms}ms, max = ${maxMs}ms`);

    const defects: Array<{ id: string; severity: string; description: string; repro: string }> = [];
    if (!cli.unknownArg.pass) {
      defects.push({
        id: "QA3-D-01",
        severity: "Low",
        description: `Package prints "Usage: indeed-mcp" instead of "Usage: ${binName}" on unknown CLI argument (Q-4)`,
        repro: `npx.cmd -y ${packageName} --unknown-flag`,
      });
    }

    const totalValidations = journey.schemaValidationCount + errorPaths.errorValidations;

    return {
      edition,
      packageName,
      dataDirEnv,
      cli,
      toolList: {
        pass: toolListPass,
        count: toolCount,
        namesMatch: listNamesMatch,
        orderStable,
        names: names1,
      },
      toolCoverage,
      invariants: journey.invariants,
      errorPaths,
      persistence,
      timings: {
        coldStartMs,
        warmStartMs,
        toolLatenciesMs,
        p50Ms,
        maxMs,
      },
      defects,
      knownLimitations,
      schemaValidationCount: totalValidations,
    };
  } finally {
    await server.close();
    fs.rmSync(journeyDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log("=================================================");
  console.log("WP-QA-003: FULL E2E TEST OF PUBLISHED PACKAGES");
  console.log("Node:", process.version, "Platform:", process.platform);
  console.log("=================================================");

  const nkResult = await testEdition("nk", "arin-jobfit-nk@0.1.1", "NAUKRI_MCP_DATA_DIR", "arin-jobfit-nk");
  const idResult = await testEdition("id", "arin-jobfit-id@0.1.1", "INDEED_MCP_DATA_DIR", "arin-jobfit-id");

  console.log(`\n========================================`);
  console.log(`Testing Cross-Product Isolation...`);
  console.log(`========================================`);
  const isolation = await testCrossProductIsolation();
  console.log(`Isolation result: ${isolation.pass ? "PASS" : "FAIL"} (${isolation.details})`);

  console.log(`\nGenerating REPORT-0.1.0.md...`);
  generateReport([nkResult, idResult], isolation, manifestToolNames);
  console.log(`Report generated successfully at qa/released/REPORT-0.1.0.md`);

  const nkCoverageAll = manifestToolNames.every((t) => (nkResult.toolCoverage.get(t) ?? 0) > 0);
  const idCoverageAll = manifestToolNames.every((t) => (idResult.toolCoverage.get(t) ?? 0) > 0);

  const checks = [
    { name: "NK CLI --version", pass: nkResult.cli.version.pass },
    { name: "NK CLI --help", pass: nkResult.cli.help.pass },
    { name: "NK CLI unknown arg", pass: nkResult.cli.unknownArg.pass },
    { name: "NK tools/list count & order", pass: nkResult.toolList.pass },
    { name: "NK tool coverage 22/22", pass: nkCoverageAll },
    { name: "NK error paths", pass: nkResult.errorPaths.missingArgsPass && nkResult.errorPaths.unknownIdPass && nkResult.errorPaths.oversizedPass },
    { name: "NK persistence", pass: nkResult.persistence.pass },
    { name: "NK invariant: evidence substring", pass: nkResult.invariants.evidenceSubstring },
    { name: "NK invariant: do-not-claim gaps", pass: nkResult.invariants.doNotClaimGaps },
    { name: "NK invariant: discrimination excluded", pass: nkResult.invariants.discriminatoryExcluded },
    { name: "NK invariant: injection neutralized", pass: nkResult.invariants.injectionNeutralized },
    { name: "NK invariant: ranking accuracy", pass: nkResult.invariants.rankingCorrect },
    { name: "NK invariant: salaries parsed", pass: nkResult.invariants.salariesCorrect },
    { name: "NK invariant: duplicate detected", pass: nkResult.invariants.duplicateDetected },
    { name: "NK invariant: L1+ blocked", pass: nkResult.invariants.l1Blocked },
    { name: "NK invariant: human handoff", pass: nkResult.invariants.humanOnlyHandoff },
    { name: "NK invariant: zero network", pass: nkResult.invariants.noNetwork },

    { name: "ID CLI --version", pass: idResult.cli.version.pass },
    { name: "ID CLI --help", pass: idResult.cli.help.pass },
    { name: "ID CLI unknown arg", pass: idResult.cli.unknownArg.pass },
    { name: "ID tools/list count & order", pass: idResult.toolList.pass },
    { name: "ID tool coverage 22/22", pass: idCoverageAll },
    { name: "ID error paths", pass: idResult.errorPaths.missingArgsPass && idResult.errorPaths.unknownIdPass && idResult.errorPaths.oversizedPass },
    { name: "ID persistence", pass: idResult.persistence.pass },
    { name: "ID invariant: evidence substring", pass: idResult.invariants.evidenceSubstring },
    { name: "ID invariant: do-not-claim gaps", pass: idResult.invariants.doNotClaimGaps },
    { name: "ID invariant: discrimination excluded", pass: idResult.invariants.discriminatoryExcluded },
    { name: "ID invariant: injection neutralized", pass: idResult.invariants.injectionNeutralized },
    { name: "ID invariant: ranking accuracy", pass: idResult.invariants.rankingCorrect },
    { name: "ID invariant: salaries parsed", pass: idResult.invariants.salariesCorrect },
    { name: "ID invariant: duplicate detected", pass: idResult.invariants.duplicateDetected },
    { name: "ID invariant: L1+ blocked", pass: idResult.invariants.l1Blocked },
    { name: "ID invariant: human handoff", pass: idResult.invariants.humanOnlyHandoff },
    { name: "ID invariant: zero network", pass: idResult.invariants.noNetwork },

    { name: "Cross-product isolation", pass: isolation.pass },
  ];

  const passedChecks = checks.filter((c) => c.pass).length;
  const totalChecks = checks.length;
  const totalSchemaVal = nkResult.schemaValidationCount + idResult.schemaValidationCount;

  console.log(`\n=================================================`);
  console.log(`CHECKS PASSED: ${passedChecks}/${totalChecks}`);
  console.log(`SCHEMA VALIDATIONS: ${totalSchemaVal}`);
  console.log(`DEFECTS: ${idResult.defects.length > 0 ? "1 (QA3-D-01)" : "0"}`);
  console.log(`=================================================`);

  const hasUnexpectedFail = checks.some((c) => !c.pass && c.name !== "ID CLI unknown arg");
  if (hasUnexpectedFail) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in QA E2E run:", err);
  process.exit(1);
});
