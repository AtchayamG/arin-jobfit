import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { openStore } from "../../src/store/open.js";
import { createTestJob, createTestProfileInput } from "./fixtures.js";

describe("Temporary directory persistence and reopen", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jpm-store-test-"));

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it("creates physical database files on disk and preserves data across reopening", () => {
    const dbFilePath = path.join(tempDir, "naukri.sqlite3");

    // 1. Initial store opening and data insertion
    const store1 = openStore({ dataDir: tempDir, product: "naukri" });
    expect(fs.existsSync(dbFilePath)).toBe(true);

    const job = createTestJob({ title: "Persisted Systems Architect" });
    const profileInput = createTestProfileInput({ label: "Persisted Candidate" });

    store1.jobs.insert(job);
    const profileRes = store1.profiles.upsert(profileInput);

    expect(store1.jobs.count()).toBe(1);
    expect(store1.profiles.count()).toBe(1);

    store1.close();

    // 2. Reopen store pointing to the same data directory
    const store2 = openStore({ dataDir: tempDir, product: "naukri" });

    expect(store2.jobs.count()).toBe(1);
    const retrievedJob = store2.jobs.get(job.job_id);
    expect(retrievedJob?.title).toBe("Persisted Systems Architect");

    expect(store2.profiles.count()).toBe(1);
    const retrievedProfile = store2.profiles.get(profileRes.profile_id);
    expect(retrievedProfile?.label).toBe("Persisted Candidate");

    store2.close();
  });

  it("throws INVALID_DATA_DIR when dataDir is omitted with memory=false", () => {
    expect(() => openStore({ memory: false, product: "naukri" })).toThrow();
  });

  it("throws INVALID_DATA_DIR when dataDir directory creation fails", () => {
    const filePath = path.join(tempDir, "regular_file.txt");
    fs.writeFileSync(filePath, "hello");

    // Attempting to create a directory where a regular file exists should fail
    const invalidSubdir = path.join(filePath, "cannot_create_dir_under_file");
    expect(() => openStore({ dataDir: invalidSubdir, product: "naukri" })).toThrow();
  });
});
