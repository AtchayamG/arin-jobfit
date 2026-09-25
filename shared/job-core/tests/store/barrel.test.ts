import { describe, expect, it } from "vitest";
import * as storeModule from "../../src/store/index.js";

describe("Store Barrel Exports", () => {
  it("exports all public classes, functions, and error types", () => {
    expect(storeModule.StoreError).toBeDefined();
    expect(storeModule.openStore).toBeDefined();
    expect(storeModule.resolveDataDir).toBeDefined();
    expect(storeModule.encodeCursor).toBeDefined();
    expect(storeModule.decodeCursor).toBeDefined();
    expect(storeModule.escapeLike).toBeDefined();
    expect(storeModule.validateJobId).toBeDefined();
    expect(storeModule.validateProfileId).toBeDefined();
    expect(storeModule.toJobSummary).toBeDefined();
    expect(storeModule.runRetention).toBeDefined();
    expect(storeModule.SqliteJobRepo).toBeDefined();
    expect(storeModule.SqliteProfileRepo).toBeDefined();
    expect(storeModule.SqliteAuditRepo).toBeDefined();
    expect(storeModule.SqliteDataRightsRepo).toBeDefined();
  });
});
