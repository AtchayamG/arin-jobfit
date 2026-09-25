#!/usr/bin/env node
/**
 * CLI Policy Linter.
 *
 * Verifies that a policy.json file complies with policyFileSchema,
 * contains valid calendar dates, and cross-checks approval references
 * verbatim against Docs/09_DECISIONS_LOG.md.
 *
 * Usage:
 *   npx tsx scripts/policy-lint.ts <path-to-policy.json> <path-to-decisions-log.md>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { lintPolicy, loadPolicy, PolicyError } from "../src/policy/index.js";

function run(): void {
  const policyArg = process.argv[2];
  const decisionsLogArg = process.argv[3];

  if (!policyArg || !decisionsLogArg) {
    console.error(
      "Usage: npx tsx scripts/policy-lint.ts <path-to-policy.json> <path-to-decisions-log.md>",
    );
    process.exit(1);
  }

  const policyPath = path.resolve(process.cwd(), policyArg);
  const decisionsLogPath = path.resolve(process.cwd(), decisionsLogArg);

  if (!fs.existsSync(policyPath)) {
    console.error(`Error: Policy file not found: ${policyPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(decisionsLogPath)) {
    console.error(`Error: Decisions log file not found: ${decisionsLogPath}`);
    process.exit(1);
  }

  let rawJson: unknown;
  try {
    const policyContent = fs.readFileSync(policyPath, "utf-8");
    rawJson = JSON.parse(policyContent);
  } catch (err) {
    console.error(`Error parsing policy JSON at ${policyPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  const now = new Date();
  let policy;
  try {
    policy = loadPolicy(rawJson, now);
  } catch (err) {
    if (err instanceof PolicyError) {
      console.error(`Policy validation error: ${err.message} [code: ${err.code}]`);
    } else {
      console.error(`Unexpected error loading policy: ${(err as Error).message}`);
    }
    process.exit(1);
  }

  let decisionsLogText = "";
  try {
    decisionsLogText = fs.readFileSync(decisionsLogPath, "utf-8");
  } catch (err) {
    console.error(`Error reading decisions log at ${decisionsLogPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  const lintResults = lintPolicy(policy, decisionsLogText);
  const errors = lintResults.filter((r) => r.level === "error");
  const warnings = lintResults.filter((r) => r.level === "warn");

  for (const warn of warnings) {
    console.warn(`[WARN] ${warn.message}`);
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`[ERROR] ${err.message}`);
    }
    console.error(`Policy lint FAILED with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(`[PASS] Policy lint clean: ${path.basename(policyPath)}`);
}

run();
