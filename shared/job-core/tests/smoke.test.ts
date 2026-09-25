import { describe, expect, it } from "vitest";
import { JOB_CORE_VERSION } from "../src/index.js";

describe("job-core", () => {
  it("exports its package version", () => {
    expect(JOB_CORE_VERSION).toBe("0.1.0");
  });
});
